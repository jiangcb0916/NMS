import ipaddress
import re
from dataclasses import dataclass

from flask import current_app


MAC_RE = re.compile(r"(?i)\b[0-9a-f]{4}[-:.][0-9a-f]{4}[-:.][0-9a-f]{4}\b|\b(?:[0-9a-f]{2}[:-]){5}[0-9a-f]{2}\b")
IP_RE = re.compile(r"\b(?:\d{1,3}\.){3}\d{1,3}\b")
INTERFACE_RE = re.compile(
    r"(?i)\b(?:"
    r"Eth-Trunk|GigabitEthernet|XGigabitEthernet|XGE|GE|10GE|25GE|40GE|100GE|"
    r"MEth|Ethernet|Eth|Vlanif|Vlan-interface"
    r")[A-Za-z0-9/.\-:]*\b"
)


@dataclass
class SwitchTraceConfig:
    core_ip: str
    username: str
    password: str
    port: int
    timeout: int
    max_hops: int


class HuaweiCliSession:
    def __init__(self, host, config):
        self.host = host
        self.config = config
        self.connection = None

    def __enter__(self):
        connect_handler = load_connect_handler()
        device = {
            "device_type": "huawei",
            "host": self.host,
            "username": self.config.username,
            "password": self.config.password,
            "port": self.config.port,
            "timeout": self.config.timeout,
            "conn_timeout": self.config.timeout,
            "auth_timeout": self.config.timeout,
            "banner_timeout": self.config.timeout,
            "fast_cli": False,
        }
        self.connection = connect_handler(**device)
        return self

    def __exit__(self, exc_type, exc, traceback):
        if self.connection:
            self.connection.disconnect()

    def run(self, command):
        return self.connection.send_command(command, read_timeout=self.config.timeout)


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
    target_mac = None
    visited = set()

    for hop_index in range(1, config.max_hops + 1):
        hop = new_hop(hop_index, current_switch)
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
            with HuaweiCliSession(current_switch, config) as session:
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

                if mac_count <= 1:
                    return finish_trace(
                        payload,
                        "terminal",
                        final_switch=current_switch,
                        final_interface=ingress_interface,
                        message="已定位到普通终端接口",
                        code=0,
                        hop=hop,
                    )

                lldp_result = lookup_lldp_neighbor(session, ingress_interface, hop)
                neighbor = lldp_result.get("neighbor") or {}
                neighbor_ip = neighbor.get("management_ip")
                if not neighbor_ip:
                    return finish_trace(
                        payload,
                        "downstream",
                        final_switch=current_switch,
                        final_interface=ingress_interface,
                        message="该接口学习到多个 MAC，但 LLDP 未发现可继续追踪的管理 IP",
                        code=0,
                        hop=hop,
                    )

                hop["status"] = "发现下联交换机，继续追踪"
                current_switch = neighbor_ip
        except Exception as exc:
            current_app.logger.warning("switch terminal trace failed on %s: %s", current_switch, exc.__class__.__name__)
            return finish_trace(
                payload,
                "failed",
                final_switch=current_switch,
                final_interface=hop.get("ingress_interface"),
                message=f"{current_switch} SSH 或命令执行失败：{exc.__class__.__name__}",
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
        max_hops=max(1, int(current_app.config.get("SWITCH_TRACE_MAX_HOPS", 5))),
    )


def load_connect_handler():
    try:
        from netmiko import ConnectHandler
    except ImportError as exc:
        raise RuntimeError("netmiko 未安装，请安装依赖后重启服务") from exc
    return ConnectHandler


def lookup_arp_on_switch(session, target_ip, hop):
    command = f"display arp | include {target_ip}"
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
    command = f"display mac-address {target_mac}"
    output = run_command(session, hop, command)
    entries = parse_mac_entries(output, target_mac=target_mac)
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
    command = f"display mac-address | include {interface}"
    output = run_command(session, hop, command)
    if output_has_cli_error(output):
        hop["commands"][-1]["summary"] = "命令返回错误"
        return {
            "command_failed": True,
            "mac_count": None,
            "mac_samples": [],
        }
    entries = parse_mac_entries(output)
    unique_macs = sorted({entry["mac"] for entry in entries if entry.get("mac")})
    if not unique_macs and hop.get("target_mac"):
        unique_macs = [hop["target_mac"]]
    command_summary = "学习到 %s 个 MAC" % len(unique_macs) if unique_macs else "未学习到 MAC"
    hop["commands"][-1]["summary"] = command_summary
    return {
        "mac_count": len(unique_macs),
        "mac_samples": unique_macs[:8],
    }


def lookup_lldp_neighbor(session, interface, hop):
    command = f"display lldp neighbor interface {command_interface_name(interface)}"
    output = run_command(session, hop, command)
    neighbor = parse_lldp_neighbor(output)
    hop["neighbor"] = neighbor
    if neighbor.get("management_ip"):
        hop["switch_name"] = neighbor.get("system_name") or hop.get("switch_name")
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
    return {
        "system_name": first_match(output, r"(?im)^\s*System\s+Name\s*:\s*(.+?)\s*$"),
        "management_ip": first_valid_ip(management_address),
        "port_id": first_match(output, r"(?im)^\s*Port\s+ID\s*:\s*(.+?)\s*$"),
        "model": first_match(output, r"(?im)^\s*System\s+Description\s*:\s*(.+?)\s*$"),
    }


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


def new_hop(index, switch_ip):
    return {
        "index": index,
        "switch_ip": switch_ip,
        "switch_name": "",
        "lookup": "",
        "target_ip": "",
        "target_mac": "",
        "ingress_interface": "",
        "mac_count": None,
        "mac_samples": [],
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
