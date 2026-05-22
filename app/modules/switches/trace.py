import ipaddress
import re
from dataclasses import dataclass

from flask import current_app


MAC_RE = re.compile(r"(?i)\b[0-9a-f]{4}[-:.][0-9a-f]{4}[-:.][0-9a-f]{4}\b|\b(?:[0-9a-f]{2}[:-]){5}[0-9a-f]{2}\b")
IP_RE = re.compile(r"\b(?:\d{1,3}\.){3}\d{1,3}\b")
INTERFACE_RE = re.compile(
    r"(?i)\b(?:"
    r"Eth-Trunk|Port-channel|GigabitEthernet|FastEthernet|TenGigabitEthernet|"
    r"TwentyFiveGigE|FortyGigabitEthernet|HundredGigE|XGigabitEthernet|XGE|"
    r"GE|10GE|25GE|40GE|100GE|Gi|Fa|Te|Tw|Fo|Hu|Po|"
    r"MEth|Ethernet|Eth|Vlanif|Vlan-interface"
    r")[A-Za-z0-9/.\-:]*\b"
)
PHYSICAL_INTERFACE_RE = re.compile(
    r"(?i)^(?:GigabitEthernet|FastEthernet|TenGigabitEthernet|TwentyFiveGigE|"
    r"FortyGigabitEthernet|HundredGigE|XGigabitEthernet|XGE|GE|10GE|25GE|"
    r"40GE|100GE|Gi|Fa|Te|Tw|Fo|Hu|Ethernet|Eth)\d"
)
NETMIKO_DEVICE_TYPES = {
    "huawei": "huawei",
    "cisco": "cisco_ios",
}
CISCO_TELNET_DEVICE_TYPE = "cisco_ios_telnet"


@dataclass
class SwitchTraceConfig:
    core_ip: str
    username: str
    password: str
    port: int
    timeout: int
    cisco_username: str
    cisco_password: str
    cisco_port: int
    cisco_timeout: int
    cisco_transport: str
    cisco_telnet_port: int
    max_hops: int


class HuaweiCliSession:
    def __init__(self, host, config, platform="huawei"):
        self.host = host
        self.config = config
        self.platform = platform if platform in NETMIKO_DEVICE_TYPES else "huawei"
        self.connection = None

    def __enter__(self):
        connect_handler = load_connect_handler()
        attempts = connection_attempts_for_platform(self.config, self.platform)
        legacy_ssh_error = None
        for attempt in attempts:
            device = build_netmiko_device(self.host, attempt)
            try:
                self.connection = connect_handler(**device)
                self.command_timeout = attempt["timeout"]
                if self.platform == "cisco":
                    self.enter_enable_mode()
                return self
            except Exception as exc:
                if attempt["transport"] == "ssh" and is_legacy_ssh_host_key_error(exc):
                    legacy_ssh_error = exc
                    continue
                if legacy_ssh_error:
                    raise RuntimeError(f"Cisco SSH HostKey 不兼容，Telnet 回退失败：{exc}") from exc
                raise
        if legacy_ssh_error:
            raise RuntimeError("Cisco SSH HostKey 不兼容，且未启用 Telnet 回退") from legacy_ssh_error
        raise RuntimeError("交换机连接方式未配置")

    def __exit__(self, exc_type, exc, traceback):
        if self.connection:
            self.connection.disconnect()

    def run(self, command):
        if self.platform == "cisco":
            return self.connection.send_command_timing(command, read_timeout=getattr(self, "command_timeout", self.config.timeout))
        return self.connection.send_command(command, read_timeout=getattr(self, "command_timeout", self.config.timeout))

    def enter_enable_mode(self):
        if not self.connection:
            return
        secret = self.config.cisco_password
        if not secret:
            return
        self.connection.secret = secret
        try:
            self.connection.enable()
        except Exception as exc:
            raise RuntimeError(f"Cisco enable 失败：{exc}") from exc

    def mac_lookup_command(self, mac):
        if self.platform == "cisco":
            return f"show mac address-table address {cisco_mac(mac)}"
        return f"display mac-address {mac}"

    def interface_macs_command(self, interface):
        if self.platform == "cisco":
            return f"show mac address-table interface {cisco_interface_name(interface)}"
        return f"display mac-address | include {interface}"

    def lldp_neighbor_command(self, interface):
        if self.platform == "cisco":
            return f"show lldp neighbors interface {cisco_interface_name(interface)} detail"
        return f"display lldp neighbor interface {command_interface_name(interface)}"

    def arp_lookup_command(self, value):
        if self.platform == "cisco":
            return f"show ip arp | include {value}"
        return f"display arp | include {value}"


def trace_terminal_ip(target_ip):
    config = build_trace_config()
    payload = empty_trace_payload(target_ip, config.core_ip)

    if not config.username or not config.password:
        payload["configured"] = False
        payload["error"] = "交换机 SSH 未配置"
        return payload, "交换机 SSH 未配置", 1

    try:
        ipaddress.ip_address(config.core_ip)
    except ValueError:
        payload["configured"] = False
        payload["error"] = "核心交换机 IP 配置不正确"
        return payload, "核心交换机 IP 配置不正确", 1

    try:
        load_connect_handler()
    except RuntimeError as exc:
        payload["configured"] = False
        payload["error"] = str(exc)
        return payload, str(exc), 1

    current_switch = config.core_ip
    current_platform = "huawei"
    target_mac = None
    visited = set()

    for hop_index in range(1, config.max_hops + 1):
        hop = new_hop(hop_index, current_switch, current_platform)
        payload["hops"].append(hop)
        if current_switch in visited:
            return finish_trace(
                payload,
                "failed",
                final_switch=current_switch,
                final_interface=hop.get("ingress_interface"),
                message="检测到 LLDP 环路，已停止追踪",
                code=1,
                hop=hop,
            )
        visited.add(current_switch)

        try:
            with HuaweiCliSession(current_switch, config, current_platform) as session:
                if target_mac:
                    lookup_result = lookup_mac_on_switch(session, target_mac, hop)
                    target_mac = lookup_result.get("mac") or target_mac
                else:
                    lookup_result = lookup_arp_on_switch(session, target_ip, hop)
                    target_mac = lookup_result.get("mac")
                    payload["target_mac"] = target_mac

                if not lookup_result.get("found"):
                    result_type = "not_found" if hop_index == 1 else "failed"
                    message = "核心 ARP 未找到" if hop_index == 1 else "下联交换机未找到目标 MAC"
                    return finish_trace(
                        payload,
                        result_type,
                        final_switch=current_switch,
                        final_interface=None,
                        message=lookup_result.get("message") or message,
                        code=0 if result_type == "not_found" else 1,
                        hop=hop,
                    )

                ingress_interface = lookup_result.get("interface")
                hop["ingress_interface"] = ingress_interface
                if not ingress_interface:
                    return finish_trace(
                        payload,
                        "failed",
                        final_switch=current_switch,
                        final_interface=None,
                        message="已找到目标 MAC，但未解析到入口接口",
                        code=1,
                        hop=hop,
                    )

                interface_result = lookup_interface_macs(session, ingress_interface, hop)
                if interface_result.get("command_failed"):
                    return finish_trace(
                        payload,
                        "failed",
                        final_switch=current_switch,
                        final_interface=ingress_interface,
                        message="接口 MAC 表查询失败",
                        code=1,
                        hop=hop,
                    )
                mac_count = interface_result.get("mac_count", 0)
                hop["mac_count"] = mac_count
                hop["mac_samples"] = interface_result.get("mac_samples", [])
                is_aggregate_interface = is_eth_trunk(ingress_interface)

                if mac_count <= 1 and not is_aggregate_interface:
                    return finish_trace(
                        payload,
                        "terminal",
                        final_switch=current_switch,
                        final_interface=ingress_interface,
                        message="已定位到普通终端接口",
                        code=0,
                        hop=hop,
                    )

                if is_aggregate_interface:
                    lldp_result = lookup_eth_trunk_lldp_neighbor(session, ingress_interface, hop)
                else:
                    lldp_result = lookup_lldp_neighbor(session, ingress_interface, hop)
                neighbor = lldp_result.get("neighbor") or {}
                neighbor_ip = resolve_lldp_neighbor_management_ip(session, neighbor, hop, config)
                if not neighbor_ip:
                    neighbor = infer_downstream_neighbor_from_interface_macs(
                        session,
                        interface_result.get("macs") or [],
                        hop,
                        config,
                    )
                    neighbor_ip = neighbor.get("management_ip") or ""
                if not neighbor_ip:
                    message = (
                        "聚合口成员未发现可继续追踪的 LLDP 管理 IP"
                        if is_aggregate_interface
                        else "该接口学习到多个 MAC，但未发现可继续追踪的管理 IP"
                    )
                    return finish_trace(
                        payload,
                        "downstream",
                        final_switch=current_switch,
                        final_interface=ingress_interface,
                        message=message,
                        code=0,
                        hop=hop,
                    )

                hop["status"] = "发现下联交换机，继续追踪"
                current_switch = neighbor_ip
                current_platform = infer_neighbor_platform(neighbor)
        except Exception as exc:
            current_app.logger.warning("switch terminal trace failed on %s: %s", current_switch, exc.__class__.__name__)
            error_detail = str(exc).strip() or exc.__class__.__name__
            return finish_trace(
                payload,
                "failed",
                final_switch=current_switch,
                final_interface=hop.get("ingress_interface"),
                message=f"{current_switch} SSH 或命令执行失败：{error_detail}",
                code=1,
                hop=hop,
            )

    return finish_trace(
        payload,
        "failed",
        final_switch=current_switch,
        final_interface=None,
        message=f"已达到最大追踪跳数 {config.max_hops}",
        code=1,
    )


def build_trace_config():
    return SwitchTraceConfig(
        core_ip=current_app.config.get("SWITCH_TRACE_CORE_IP", "172.16.100.5"),
        username=current_app.config.get("SWITCH_SSH_USERNAME") or "",
        password=current_app.config.get("SWITCH_SSH_PASSWORD") or "",
        port=int(current_app.config.get("SWITCH_SSH_PORT", 22)),
        timeout=int(current_app.config.get("SWITCH_SSH_TIMEOUT", 8)),
        cisco_username=current_app.config.get("SWITCH_CISCO_SSH_USERNAME") or "",
        cisco_password=current_app.config.get("SWITCH_CISCO_SSH_PASSWORD") or "",
        cisco_port=int(current_app.config.get("SWITCH_CISCO_SSH_PORT", current_app.config.get("SWITCH_SSH_PORT", 22))),
        cisco_timeout=int(current_app.config.get("SWITCH_CISCO_SSH_TIMEOUT", current_app.config.get("SWITCH_SSH_TIMEOUT", 8))),
        cisco_transport=str(current_app.config.get("SWITCH_CISCO_TRANSPORT", "auto") or "auto").strip().lower(),
        cisco_telnet_port=int(current_app.config.get("SWITCH_CISCO_TELNET_PORT", 23)),
        max_hops=max(1, int(current_app.config.get("SWITCH_TRACE_MAX_HOPS", 5))),
    )


def connection_attempts_for_platform(config, platform):
    if platform == "cisco":
        username = config.cisco_username or config.username
        if not username:
            raise RuntimeError("Cisco 交换机 SSH 用户名未配置，请设置 SWITCH_CISCO_SSH_USERNAME 或 SWITCH_SSH_USERNAME")
        if not config.cisco_password:
            raise RuntimeError("Cisco 交换机 SSH 密码未配置，请设置 SWITCH_CISCO_SSH_PASSWORD")
        base_attempt = {
            "username": username,
            "password": config.cisco_password,
            "timeout": config.cisco_timeout,
        }
        ssh_attempt = {
            **base_attempt,
            "transport": "ssh",
            "device_type": NETMIKO_DEVICE_TYPES["cisco"],
            "port": config.cisco_port,
        }
        telnet_attempt = {
            **base_attempt,
            "transport": "telnet",
            "device_type": CISCO_TELNET_DEVICE_TYPE,
            "port": config.cisco_telnet_port,
        }
        if config.cisco_transport == "telnet":
            return [telnet_attempt]
        if config.cisco_transport == "ssh":
            return [ssh_attempt]
        return [ssh_attempt, telnet_attempt]
    return [{
        "username": config.username,
        "password": config.password,
        "port": config.port,
        "timeout": config.timeout,
        "transport": "ssh",
        "device_type": NETMIKO_DEVICE_TYPES["huawei"],
    }]


def ssh_settings_for_platform(config, platform):
    return connection_attempts_for_platform(config, platform)[0]


def build_netmiko_device(host, attempt):
    device = {
        "device_type": attempt["device_type"],
        "host": host,
        "username": attempt["username"],
        "password": attempt["password"],
        "port": attempt["port"],
        "timeout": attempt["timeout"],
        "conn_timeout": attempt["timeout"],
        "auth_timeout": attempt["timeout"],
        "banner_timeout": attempt["timeout"],
        "fast_cli": False,
        "allow_agent": False,
        "use_keys": False,
        "ssh_strict": False,
        "system_host_keys": False,
    }
    if attempt["transport"] == "ssh":
        device["disabled_algorithms"] = {
            "keys": ["ssh-dss", "ssh-dss-cert-v01@openssh.com"],
            "pubkeys": ["ssh-dss", "ssh-dss-cert-v01@openssh.com"],
        }
    return device


def is_legacy_ssh_host_key_error(exc):
    text = str(exc)
    return (
        "p must be exactly 1024, 2048, 3072, or 4096 bits long" in text
        or "ssh-dss" in text.lower()
        or "no acceptable host key" in text.lower()
    )


def load_connect_handler():
    try:
        from netmiko import ConnectHandler
    except ImportError as exc:
        raise RuntimeError("netmiko 未安装，请安装依赖后重启服务") from exc
    return ConnectHandler


def lookup_arp_on_switch(session, target_ip, hop):
    command = session.arp_lookup_command(target_ip)
    output = run_command(session, hop, command)
    arp_entry = parse_arp(output, target_ip)
    if not arp_entry:
        hop["status"] = "核心 ARP 未找到"
        return {"found": False, "message": "核心 ARP 未找到"}
    hop["target_ip"] = arp_entry["ip"]
    hop["target_mac"] = arp_entry["mac"]
    hop["ingress_interface"] = arp_entry["interface"]
    hop["lookup"] = "arp"
    hop["status"] = "ARP 已匹配"
    return {
        "found": True,
        "mac": arp_entry["mac"],
        "interface": arp_entry["interface"],
    }


def lookup_mac_on_switch(session, target_mac, hop):
    command = session.mac_lookup_command(target_mac)
    output = run_command(session, hop, command)
    entries = parse_mac_entries(output, target_mac=target_mac)
    if not entries and session.platform == "cisco":
        entries = lookup_cisco_mac_table(session, hop, target_mac=target_mac)
    if not entries:
        hop["target_mac"] = target_mac
        hop["lookup"] = "mac"
        hop["status"] = "目标 MAC 未找到"
        return {"found": False, "message": "下联交换机未找到目标 MAC"}
    entry = entries[0]
    hop["target_mac"] = entry["mac"]
    hop["ingress_interface"] = entry["interface"]
    hop["lookup"] = "mac"
    hop["status"] = "MAC 表已匹配"
    return {
        "found": True,
        "mac": entry["mac"],
        "interface": entry["interface"],
    }


def lookup_interface_macs(session, interface, hop):
    command = session.interface_macs_command(interface)
    output = run_command(session, hop, command)
    if output_has_cli_error(output):
        if session.platform != "cisco":
            hop["commands"][-1]["summary"] = "命令返回错误"
            return {
                "command_failed": True,
                "mac_count": None,
                "mac_samples": [],
                "macs": [],
            }
        hop["commands"][-1]["summary"] = "接口过滤不支持，改用全表解析"
        entries = lookup_cisco_mac_table(session, hop, target_mac=hop.get("target_mac"), interface=interface)
    else:
        entries = parse_mac_entries(output)
    unique_macs = sorted({entry["mac"] for entry in entries if entry.get("mac")})
    if not unique_macs and hop.get("target_mac"):
        unique_macs = [hop["target_mac"]]
    command_summary = "学习到 %s 个 MAC" % len(unique_macs) if unique_macs else "未学习到 MAC"
    hop["commands"][-1]["summary"] = command_summary
    return {
        "mac_count": len(unique_macs),
        "mac_samples": unique_macs[:8],
        "macs": unique_macs,
    }


def lookup_cisco_mac_table(session, hop, target_mac=None, interface=None):
    entries = []
    if target_mac:
        output = run_command(session, hop, session.mac_lookup_command(target_mac))
        entries = parse_mac_entries(output, target_mac=target_mac)
    if not entries:
        output = run_command(session, hop, "show mac address-table")
        entries = parse_mac_entries(output, target_mac=target_mac)
    if interface:
        entries = [
            entry for entry in entries
            if same_interface(entry.get("interface"), interface)
        ]
    if target_mac:
        hop["commands"][-1]["summary"] = (
            "全表匹配目标 MAC 成功" if entries else "全表未找到目标 MAC"
        )
    elif interface:
        hop["commands"][-1]["summary"] = (
            f"全表解析接口 {interface}，学习到 {len({entry['mac'] for entry in entries if entry.get('mac')})} 个 MAC"
            if entries
            else f"全表未找到接口 {interface} 的 MAC"
        )
    return entries


def lookup_eth_trunk_members(session, interface, hop):
    command = f"display interface {command_interface_name(interface)}"
    output = run_command(session, hop, command)
    hop["aggregate_interface"] = interface
    if output_has_cli_error(output):
        hop["commands"][-1]["summary"] = "聚合口成员查询失败"
        return {"members": [], "command_failed": True}

    members = parse_eth_trunk_members(output)
    hop["trunk_members"] = members
    hop["commands"][-1]["summary"] = (
        f"发现 {len(members)} 个聚合成员口"
        if members
        else "未解析到聚合成员口"
    )
    return {"members": members, "command_failed": False}


def lookup_eth_trunk_lldp_neighbor(session, interface, hop):
    member_result = lookup_eth_trunk_members(session, interface, hop)
    members = member_result.get("members") or []
    for member in members:
        lldp_result = lookup_lldp_neighbor(session, member, hop)
        neighbor = lldp_result.get("neighbor") or {}
        if neighbor.get("management_ip"):
            hop["lldp_interface"] = member
            return lldp_result

    if not members:
        return lookup_lldp_neighbor(session, interface, hop)
    return {"neighbor": {}}


def resolve_lldp_neighbor_management_ip(session, neighbor, hop, config):
    neighbor_ip = neighbor.get("management_ip") or ""
    if is_expected_switch_management_ip(neighbor_ip, config):
        return neighbor_ip

    chassis_mac = neighbor.get("chassis_mac") or normalize_mac(neighbor.get("chassis_id"))
    if chassis_mac and len(re.sub(r"[^0-9A-Fa-f]", "", chassis_mac)) == 12:
        arp_entry = lookup_arp_by_mac(session, chassis_mac, hop, config)
        if arp_entry:
            neighbor["lldp_management_ip"] = neighbor_ip
            neighbor["management_ip"] = arp_entry["ip"]
            neighbor["resolved_by"] = "arp_mac"
            if is_known_fake_management_ip(neighbor_ip):
                neighbor["platform"] = "cisco"
            hop["neighbor"] = neighbor
            return arp_entry["ip"]

    if is_known_fake_management_ip(neighbor_ip):
        neighbor["lldp_management_ip"] = neighbor_ip
        neighbor["management_ip"] = ""
        hop["neighbor"] = neighbor
        return ""
    return neighbor_ip


def infer_downstream_neighbor_from_interface_macs(session, macs, hop, config):
    entries = lookup_arp_entries_by_macs(session, macs, hop)
    candidates = [
        entry for entry in entries
        if entry.get("ip") != session.host and is_expected_switch_management_ip(entry.get("ip"), config)
    ]
    if not candidates:
        if hop.get("commands"):
            hop["commands"][-1]["summary"] = "接口 MAC/ARP 未推断到下联管理 IP"
        return {}

    selected = candidates[0]
    if hop.get("commands"):
        hop["commands"][-1]["summary"] = f"通过接口 MAC/ARP 推断下联 {selected['ip']}"
    neighbor = {
        "chassis_id": selected["mac"],
        "chassis_mac": selected["mac"],
        "system_name": "",
        "management_ip": selected["ip"],
        "port_id": "",
        "model": "",
        "platform": infer_platform_from_mac(selected["mac"]),
        "resolved_by": "interface_arp_mac",
    }
    hop["neighbor"] = neighbor
    return neighbor


def lookup_arp_entries_by_macs(session, macs, hop):
    mac_set = {normalize_mac(mac) for mac in macs if mac}
    if not mac_set:
        return []

    command = "show ip arp" if session.platform == "cisco" else "display arp"
    output = run_command(session, hop, command)
    entries = parse_arp_entries_by_macs(output, mac_set)
    if not entries and session.platform == "cisco":
        hop["commands"][-1]["summary"] = "ARP 全表未匹配接口 MAC"
    return entries


def lookup_arp_by_mac(session, mac, hop, config):
    lookup_mac = cisco_mac(mac) if session.platform == "cisco" else normalize_mac(mac)
    command = session.arp_lookup_command(lookup_mac)
    output = run_command(session, hop, command)
    entries = parse_arp_by_mac(output, mac)
    if not entries:
        hop["commands"][-1]["summary"] = "未通过邻居 MAC 反查到管理 IP"
        return None

    selected = first_expected_management_entry(entries, config) or entries[0]
    hop["commands"][-1]["summary"] = f"通过邻居 MAC 反查到 {selected['ip']}"
    return selected


def lookup_lldp_neighbor(session, interface, hop):
    command = session.lldp_neighbor_command(interface)
    output = run_command(session, hop, command)
    neighbor = parse_lldp_neighbor(output)
    hop["neighbor"] = neighbor
    if neighbor.get("management_ip"):
        hop["switch_name"] = neighbor.get("system_name") or hop.get("switch_name")
        hop["lldp_interface"] = interface
        hop["commands"][-1]["summary"] = f"发现邻居 {neighbor.get('system_name') or neighbor['management_ip']}"
    else:
        hop["commands"][-1]["summary"] = "未发现带管理 IP 的 LLDP 邻居"
    return {"neighbor": neighbor}


def run_command(session, hop, command):
    try:
        output = session.run(command) or ""
        hop["commands"].append(command_record(command, output=output))
        return output
    except Exception as exc:
        hop["commands"].append(command_record(command, error=f"{exc.__class__.__name__}"))
        raise


def parse_arp(output, target_ip):
    for line in useful_lines(output):
        if first_valid_ip(line) != target_ip:
            continue
        mac = first_mac(line)
        if not mac:
            continue
        return {
            "ip": target_ip,
            "mac": normalize_mac(mac),
            "interface": last_interface(line),
            "raw_line": line,
        }
    return None


def parse_mac_entries(output, target_mac=None):
    normalized_target = normalize_mac(target_mac) if target_mac else None
    entries = []
    for line in useful_lines(output):
        mac = first_mac(line)
        if not mac:
            continue
        normalized_mac = normalize_mac(mac)
        if normalized_target and normalized_mac != normalized_target:
            continue
        entries.append({
            "mac": normalized_mac,
            "interface": last_interface(line),
            "raw_line": line,
        })
    return entries


def parse_lldp_neighbor(output):
    management_address = (
        first_match(output, r"(?im)^\s*Management\s+Address\s*:\s*(\S+)")
        or first_match(output, r"(?im)^\s*Management\s+address\s+value\s*:\s*(\S+)")
    )
    chassis_id = (
        first_match(output, r"(?im)^\s*Chassis\s+ID\s*:\s*(\S+)")
        or first_match(output, r"(?im)^\s*ChassisID\s*:\s*(\S+)")
    )
    system_name = first_match(output, r"(?im)^\s*System\s+Name\s*:\s*(.+?)\s*$")
    model = first_match(output, r"(?im)^\s*System\s+Description\s*:\s*(.+?)\s*$")
    return {
        "chassis_id": chassis_id,
        "chassis_mac": normalize_mac(first_mac(chassis_id)),
        "system_name": system_name,
        "management_ip": first_valid_ip(management_address),
        "port_id": first_match(output, r"(?im)^\s*Port\s+ID\s*:\s*(.+?)\s*$"),
        "model": model,
        "platform": infer_platform_from_text(system_name, model),
    }


def parse_arp_by_mac(output, target_mac):
    normalized_target = normalize_mac(target_mac)
    entries = []
    for line in useful_lines(output):
        mac = first_mac(line)
        if not mac or normalize_mac(mac) != normalized_target:
            continue
        ip_value = first_valid_ip(line)
        if not ip_value:
            continue
        entries.append({
            "ip": ip_value,
            "mac": normalized_target,
            "interface": last_interface(line),
            "raw_line": line,
        })
    return entries


def parse_arp_entries_by_macs(output, target_macs):
    normalized_targets = {normalize_mac(mac) for mac in target_macs if mac}
    entries = []
    for line in useful_lines(output):
        ip = first_valid_ip(line)
        mac = first_mac(line)
        if not ip or not mac:
            continue
        normalized_mac = normalize_mac(mac)
        if normalized_mac not in normalized_targets:
            continue
        entries.append({
            "ip": ip,
            "mac": normalized_mac,
            "interface": last_interface(line),
            "raw_line": line,
        })
    return entries


def parse_eth_trunk_members(output):
    members = []
    seen = set()
    for line in useful_lines(output):
        for interface in INTERFACE_RE.findall(line):
            interface = compact_interface_name(interface)
            if not is_physical_interface(interface):
                continue
            key = interface.lower()
            if key in seen:
                continue
            seen.add(key)
            members.append(interface)
    return members


def normalize_mac(value):
    if not value:
        return ""
    hex_value = re.sub(r"[^0-9A-Fa-f]", "", str(value))
    if len(hex_value) != 12:
        return str(value).strip().lower()
    return "-".join(hex_value[i:i + 4] for i in range(0, 12, 4)).lower()


def useful_lines(output):
    return [
        line.strip()
        for line in str(output or "").splitlines()
        if line.strip() and not line.strip().startswith(("<", "#"))
    ]


def first_mac(line):
    match = MAC_RE.search(line or "")
    return match.group(0) if match else ""


def last_interface(line):
    matches = INTERFACE_RE.findall(line or "")
    return matches[-1] if matches else ""


def command_interface_name(interface):
    value = str(interface or "").strip()
    patterns = [
        (r"(?i)^GigabitEthernet(\d.*)$", r"GigabitEthernet \1"),
        (r"(?i)^GE(\d.*)$", r"GigabitEthernet \1"),
        (r"(?i)^XGigabitEthernet(\d.*)$", r"XGigabitEthernet \1"),
        (r"(?i)^XGE(\d.*)$", r"XGigabitEthernet \1"),
        (r"(?i)^(10GE|25GE|40GE|100GE)(\d.*)$", r"\1 \2"),
        (r"(?i)^Eth-Trunk(\d.*)$", r"Eth-Trunk \1"),
    ]
    for pattern, replacement in patterns:
        if re.match(pattern, value):
            return re.sub(pattern, replacement, value)
    return value


def cisco_interface_name(interface):
    value = compact_interface_name(interface)
    patterns = [
        (r"(?i)^GigabitEthernet(\d.*)$", r"Gi\1"),
        (r"(?i)^FastEthernet(\d.*)$", r"Fa\1"),
        (r"(?i)^TenGigabitEthernet(\d.*)$", r"Te\1"),
        (r"(?i)^TwentyFiveGigE(\d.*)$", r"Tw\1"),
        (r"(?i)^FortyGigabitEthernet(\d.*)$", r"Fo\1"),
        (r"(?i)^HundredGigE(\d.*)$", r"Hu\1"),
        (r"(?i)^Port-channel(\d.*)$", r"Po\1"),
    ]
    for pattern, replacement in patterns:
        if re.match(pattern, value):
            return re.sub(pattern, replacement, value)
    return value


def cisco_mac(mac):
    hex_value = re.sub(r"[^0-9A-Fa-f]", "", str(mac or ""))
    if len(hex_value) != 12:
        return str(mac or "").strip().lower()
    return ":".join(hex_value[i:i + 2] for i in range(0, 12, 2)).lower()


def same_interface(left, right):
    return cisco_interface_name(left).lower() == cisco_interface_name(right).lower()


def compact_interface_name(interface):
    value = str(interface or "").strip()
    patterns = [
        (r"(?i)^(GigabitEthernet)\s+(\d.*)$", r"\1\2"),
        (r"(?i)^(XGigabitEthernet)\s+(\d.*)$", r"\1\2"),
        (r"(?i)^(XGE)\s+(\d.*)$", r"\1\2"),
        (r"(?i)^(GE)\s+(\d.*)$", r"\1\2"),
        (r"(?i)^((?:10|25|40|100)GE)\s+(\d.*)$", r"\1\2"),
        (r"(?i)^(Gi)\s+(\d.*)$", r"\1\2"),
        (r"(?i)^(Fa)\s+(\d.*)$", r"\1\2"),
        (r"(?i)^(Te)\s+(\d.*)$", r"\1\2"),
        (r"(?i)^(Tw)\s+(\d.*)$", r"\1\2"),
        (r"(?i)^(Fo)\s+(\d.*)$", r"\1\2"),
        (r"(?i)^(Hu)\s+(\d.*)$", r"\1\2"),
        (r"(?i)^(Po)\s+(\d.*)$", r"\1\2"),
        (r"(?i)^(Port-channel)\s+(\d.*)$", r"\1\2"),
        (r"(?i)^(Ethernet)\s+(\d.*)$", r"\1\2"),
        (r"(?i)^(Eth)\s+(\d.*)$", r"\1\2"),
        (r"(?i)^(Eth-Trunk)\s+(\d.*)$", r"\1\2"),
    ]
    for pattern, replacement in patterns:
        if re.match(pattern, value):
            return re.sub(pattern, replacement, value)
    return value


def is_eth_trunk(interface):
    return bool(re.match(r"(?i)^Eth-Trunk\d", compact_interface_name(interface)))


def is_physical_interface(interface):
    return bool(PHYSICAL_INTERFACE_RE.match(compact_interface_name(interface)))


def infer_neighbor_platform(neighbor):
    if (
        neighbor.get("resolved_by") == "arp_mac"
        and is_known_fake_management_ip(neighbor.get("lldp_management_ip"))
    ):
        return "cisco"
    return neighbor.get("platform") or infer_platform_from_text(neighbor.get("system_name"), neighbor.get("model"))


def infer_platform_from_mac(mac):
    hex_value = re.sub(r"[^0-9A-Fa-f]", "", str(mac or "")).lower()
    if hex_value.startswith("d468ba"):
        return "cisco"
    return "huawei"


def infer_platform_from_text(*values):
    text = " ".join(str(value or "") for value in values).lower()
    if "cisco" in text or "ios software" in text:
        return "cisco"
    return "huawei"


def is_expected_switch_management_ip(ip_value, config):
    if not ip_value:
        return False
    try:
        core_network = ipaddress.ip_network(f"{config.core_ip}/24", strict=False)
        return ipaddress.ip_address(ip_value) in core_network
    except ValueError:
        return False


def first_expected_management_entry(entries, config):
    return next((entry for entry in entries if is_expected_switch_management_ip(entry.get("ip"), config)), None)


def is_known_fake_management_ip(ip_value):
    if not ip_value:
        return False
    try:
        ip_obj = ipaddress.ip_address(ip_value)
    except ValueError:
        return False
    return (
        str(ip_obj) == "192.168.0.1"
        or ip_obj.is_loopback
        or ip_obj.is_link_local
        or ip_obj.is_unspecified
    )


def output_has_cli_error(output):
    text = str(output or "")
    return bool(re.search(
        r"(?im)^\s*(?:\^|Error:|% ?Error|Wrong parameter|Incomplete command|Unrecognized command|Unknown command)",
        text,
    ))


def first_match(output, pattern):
    match = re.search(pattern, output or "")
    return match.group(1).strip() if match else ""


def first_valid_ip(value):
    if not value:
        return ""
    match = IP_RE.search(value)
    if not match:
        return ""
    ip_value = match.group(0)
    try:
        return str(ipaddress.ip_address(ip_value))
    except ValueError:
        return ""


def output_preview(output):
    lines = useful_lines(output)[:5]
    preview = " / ".join(lines)
    return preview[:500]


def command_record(command, output="", error=""):
    summary = "执行成功" if not error else "执行失败"
    return {
        "command": command,
        "summary": summary,
        "output_preview": output_preview(output),
        "error": error,
    }


def empty_trace_payload(target_ip, core_ip):
    return {
        "target_ip": target_ip,
        "target_mac": "",
        "start_switch": core_ip,
        "final_switch": "",
        "final_interface": "",
        "result_type": "failed",
        "configured": True,
        "hops": [],
        "error": "",
    }


def new_hop(index, switch_ip, platform="huawei"):
    return {
        "index": index,
        "switch_ip": switch_ip,
        "platform": platform,
        "switch_name": "",
        "lookup": "",
        "target_ip": "",
        "target_mac": "",
        "ingress_interface": "",
        "mac_count": None,
        "mac_samples": [],
        "aggregate_interface": "",
        "trunk_members": [],
        "lldp_interface": "",
        "neighbor": {},
        "commands": [],
        "status": "开始追踪",
        "error": "",
    }


def finish_trace(payload, result_type, final_switch, final_interface, message, code, hop=None):
    payload["result_type"] = result_type
    payload["final_switch"] = final_switch or ""
    payload["final_interface"] = final_interface or ""
    payload["error"] = "" if code == 0 else message
    if hop is not None:
        hop["status"] = message
        if code != 0:
            hop["error"] = message
    return payload, message, code
