import json
import os
import re
import threading
import time
from contextlib import contextmanager
from datetime import datetime, timedelta

from flask import current_app

from app.modules.switches.trace import (
    HuaweiCliSession,
    build_trace_config,
    compact_interface_name,
    first_mac,
    first_valid_ip,
    infer_platform_from_text,
    is_expected_switch_management_ip,
    is_known_fake_management_ip,
    management_ip_override_for_name,
    normalize_mac,
    parse_management_ip_overrides,
    parse_arp_entries_by_macs,
)


TOPOLOGY_CACHE_VERSION = 5
_cache_lock = threading.Lock()


class TopologyDiscoveryError(RuntimeError):
    pass


def load_topology_snapshot(force=False):
    requested_at = time.time()
    cached = read_topology_cache()
    if cached and force:
        cooldown_meta = force_refresh_cooldown_meta(cached, requested_at)
        if cooldown_meta:
            return cached, cooldown_meta
    if cached and not force and cache_is_fresh(cached, requested_at):
        return cached, cache_meta(cached=True)

    with topology_cache_lock():
        cached = read_topology_cache()
        if cached:
            if force:
                cooldown_meta = force_refresh_cooldown_meta(cached)
                if cooldown_meta:
                    return cached, cooldown_meta
            refreshed_after_request = float(cached.get("generated_timestamp") or 0) >= requested_at
            if refreshed_after_request or (not force and cache_is_fresh(cached)):
                return cached, cache_meta(cached=True)

        retry_after = topology_discovery_retry_after()
        if retry_after:
            if cached:
                return cached, cache_meta(
                    cached=True,
                    stale=not cache_is_fresh(cached),
                    rate_limited=True,
                    retry_after=retry_after,
                )
            raise TopologyDiscoveryError(f"拓扑重新发现冷却中，请在 {retry_after} 秒后再试")

        try:
            write_topology_discovery_attempt()
            snapshot = discover_topology()
            write_topology_cache(snapshot)
            return snapshot, cache_meta(cached=False)
        except Exception as exc:
            if cached:
                return cached, cache_meta(
                    cached=True,
                    stale=True,
                    error=str(exc).strip() or exc.__class__.__name__,
                )
            if isinstance(exc, TopologyDiscoveryError):
                raise
            raise TopologyDiscoveryError(str(exc).strip() or "LLDP 拓扑发现失败") from exc


def discover_topology():
    config = build_trace_config()
    if not config.username or not config.password:
        raise TopologyDiscoveryError("交换机 SSH 未配置")

    try:
        with HuaweiCliSession(config.core_ip, config, "huawei") as session:
            output = session.run("display lldp neighbor")
            neighbors = parse_lldp_neighbors(output)
            unresolved_macs = unresolved_neighbor_macs(neighbors, config)
            if unresolved_macs:
                try:
                    arp_output = session.run("display arp")
                except Exception as exc:
                    current_app.logger.warning("topology ARP enrichment failed: %s", exc.__class__.__name__)
                    arp_output = ""
                resolve_neighbor_management_ips(neighbors, arp_output, config)
    except Exception as exc:
        raise TopologyDiscoveryError(f"核心交换机 LLDP 查询失败：{str(exc).strip() or exc.__class__.__name__}") from exc

    if not neighbors:
        raise TopologyDiscoveryError("核心交换机未返回可识别的 LLDP 邻居")

    discovered_at = datetime.now()
    nodes, edges, warnings = build_topology_structure(
        config.core_ip,
        neighbors,
        current_app.config.get("HUAWEI_FIREWALL_TARGET") or "",
        topology_settings_from_config(),
    )
    return {
        "version": TOPOLOGY_CACHE_VERSION,
        "generated_timestamp": discovered_at.timestamp(),
        "generated_at": discovered_at.strftime("%Y-%m-%d %H:%M:%S"),
        "expires_at": (discovered_at + timedelta(seconds=topology_cache_seconds())).strftime("%Y-%m-%d %H:%M:%S"),
        "source": "LLDP + 端口映射",
        "core_ip": config.core_ip,
        "nodes": nodes,
        "edges": edges,
        "warnings": warnings,
    }


def parse_lldp_neighbors(output):
    text = str(output or "")
    headers = list(re.finditer(
        r"(?im)^\s*(\S+)\s+has\s+\d+\s+neighbor\(s\):\s*$",
        text,
    ))
    neighbors = []
    for index, header in enumerate(headers):
        section_end = headers[index + 1].start() if index + 1 < len(headers) else len(text)
        section = text[header.end():section_end]
        local_interface = compact_interface_name(header.group(1))
        blocks = re.split(r"(?im)^\s*Neighbor\s+index\s*:\s*\d+\s*$", section)
        for block in blocks[1:]:
            neighbor = parse_lldp_neighbor_block(block)
            if not neighbor.get("system_name") and not neighbor.get("chassis_id"):
                continue
            neighbor["local_interface"] = local_interface
            neighbors.append(neighbor)
    return neighbors


def parse_lldp_neighbor_block(block):
    chassis_id = match_line(block, "Chassis ID")
    system_name = match_line(block, "System name")
    system_description = match_line(block, "System description")
    capabilities = match_line(block, "System capabilities enabled") or match_line(
        block,
        "System capabilities supported",
    )
    management_values = re.findall(
        r"(?im)^\s*Management\s+address\s+value\s*:\s*(\S+)\s*$",
        block,
    )
    management_ip = next((first_valid_ip(value) for value in management_values if first_valid_ip(value)), "")
    return {
        "chassis_id": chassis_id,
        "chassis_mac": normalize_mac(first_mac(chassis_id)),
        "system_name": system_name,
        "system_description": system_description,
        "management_ip": management_ip,
        "remote_interface": compact_interface_name(match_line(block, "Port ID")),
        "capabilities": capabilities,
        "platform": infer_platform_from_text(system_name, system_description),
    }


def build_topology_structure(core_ip, neighbors, firewall_target="", settings=None):
    settings = settings or {}
    core_nodes, core_by_slot = build_core_member_nodes(core_ip, settings.get("core_members") or [])
    nodes_by_key = {node["id"]: node for node in core_nodes}
    edges_by_key = {}
    warnings = list(settings.get("configuration_warnings") or [])
    firewall_neighbors = []
    firewall_members = settings.get("firewall_members") or []
    carrier_bindings = add_configured_carrier_topology(
        nodes_by_key,
        edges_by_key,
        core_nodes,
        core_by_slot,
        settings.get("carrier_links") or [],
        warnings,
    )

    for neighbor in neighbors:
        configured_ip = management_ip_override_for_name(
            neighbor.get("system_name"),
            settings.get("management_ip_overrides") or {},
        )
        if configured_ip:
            observed_ip = neighbor.get("management_ip") or ""
            if observed_ip and observed_ip != configured_ip:
                neighbor["lldp_management_ip"] = observed_ip
            neighbor["management_ip"] = configured_ip
            neighbor["management_ip_source"] = "configured_name"
        local_interface = canonical_interface_name(neighbor.get("local_interface"))
        if local_interface in carrier_bindings:
            apply_carrier_neighbor(carrier_bindings[local_interface], neighbor)
            continue
        neighbor_type = classify_neighbor(
            neighbor,
            firewall_target,
            settings.get("uplink_patterns") or [],
        )
        if neighbor_type == "firewall" and firewall_members:
            firewall_neighbors.append(neighbor)
            continue
        if neighbor_type == "firewall" and firewall_target:
            neighbor["management_ip"] = firewall_target
        stable_value = neighbor.get("chassis_mac") or neighbor.get("management_ip") or neighbor.get("system_name")
        target_id = node_id(neighbor_type, stable_value)
        node = nodes_by_key.setdefault(target_id, {
            "id": target_id,
            "type": neighbor_type,
            "name": neighbor.get("system_name") or neighbor.get("management_ip") or "未命名邻居",
            "ip": neighbor.get("management_ip") or "",
            "chassis_id": neighbor.get("chassis_id") or "",
            "vendor": neighbor.get("platform") or "unknown",
            "model": neighbor.get("system_description") or "",
            "lldp_observed": True,
        })
        if not node.get("ip") and neighbor.get("management_ip"):
            node["ip"] = neighbor["management_ip"]
        if not node.get("model") and neighbor.get("system_description"):
            node["model"] = neighbor["system_description"]

        source_id = core_node_id_for_interface(
            neighbor.get("local_interface"),
            core_by_slot,
            core_nodes[0]["id"],
        )
        edge_key = f"{source_id}--{target_id}"
        edge = edges_by_key.setdefault(edge_key, {
            "id": edge_key,
            "source": source_id,
            "target": target_id,
            "links": [],
            "relationship_source": "lldp",
        })
        link = {
            "local_interface": neighbor.get("local_interface") or "",
            "remote_interface": neighbor.get("remote_interface") or "",
            "source": "lldp",
        }
        if link not in edge["links"]:
            edge["links"].append(link)

    if firewall_members:
        add_firewall_ha_topology(
            nodes_by_key,
            edges_by_key,
            core_nodes,
            core_by_slot,
            firewall_neighbors,
            firewall_members,
            firewall_target,
            settings.get("firewall_ha_mode") or "active-active",
            warnings,
        )

    for node in nodes_by_key.values():
        if node["type"] == "switch" and not node.get("ip"):
            warnings.append(f"{node['name']} 未上报 IPv4 管理地址，在线状态无法关联")

    edges = []
    for edge in edges_by_key.values():
        edge["link_count"] = len(edge["links"])
        edge["observed_link_count"] = sum(
            1
            for link in edge["links"]
            if link.get("source") == "lldp" or link.get("observed")
        )
        edges.append(edge)
    nodes = sorted(nodes_by_key.values(), key=topology_node_sort_key)
    edges.sort(key=lambda item: (item["source"], item["target"]))
    return nodes, edges, warnings


def classify_neighbor(neighbor, firewall_target="", uplink_patterns=None):
    text = " ".join([
        neighbor.get("system_name") or "",
        neighbor.get("system_description") or "",
        neighbor.get("capabilities") or "",
    ]).lower()
    if (
        neighbor.get("management_ip") == firewall_target
        or "firewall" in text
        or re.search(r"\busg\d*\b", text)
    ):
        return "firewall"
    if any(pattern in text for pattern in (uplink_patterns or []) if pattern):
        return "uplink"
    return "switch"


def topology_settings_from_config():
    configuration_warnings = []
    return {
        "core_members": [
            {"slot": "0", "name": current_app.config.get("SWITCH_TOPOLOGY_CORE_MEMBER_A_NAME") or "HeXinA"},
            {"slot": "1", "name": current_app.config.get("SWITCH_TOPOLOGY_CORE_MEMBER_B_NAME") or "HeXinB"},
        ],
        "uplink_patterns": [
            item.strip().lower()
            for item in str(current_app.config.get("SWITCH_TOPOLOGY_UPLINK_PATTERNS") or "").split(",")
            if item.strip()
        ],
        "management_ip_overrides": parse_management_ip_overrides(
            current_app.config.get("SWITCH_MANAGEMENT_IP_OVERRIDES")
        ),
        "carrier_links": [
            {
                "key": "unicom",
                "name": "联通线路",
                "local_interface": current_app.config.get("SWITCH_TOPOLOGY_UNICOM_INTERFACE") or "",
            },
            {
                "key": "telecom",
                "name": "电信线路",
                "local_interface": current_app.config.get("SWITCH_TOPOLOGY_TELECOM_INTERFACE") or "",
            },
        ],
        "firewall_ha_mode": current_app.config.get("HUAWEI_FIREWALL_HA_MODE") or "active-active",
        "firewall_members": [
            {
                "key": "fw1",
                "name": current_app.config.get("HUAWEI_FIREWALL_MEMBER_A_NAME") or "FW1",
                "ip": current_app.config.get("HUAWEI_FIREWALL_MEMBER_A_IP") or "",
                "links": parse_configured_core_links(
                    current_app.config.get("HUAWEI_FIREWALL_MEMBER_A_CORE_LINKS") or "",
                    configuration_warnings,
                    current_app.config.get("HUAWEI_FIREWALL_MEMBER_A_NAME") or "FW1",
                ),
            },
            {
                "key": "fw2",
                "name": current_app.config.get("HUAWEI_FIREWALL_MEMBER_B_NAME") or "FW2",
                "ip": current_app.config.get("HUAWEI_FIREWALL_MEMBER_B_IP") or "",
                "links": parse_configured_core_links(
                    current_app.config.get("HUAWEI_FIREWALL_MEMBER_B_CORE_LINKS") or "",
                    configuration_warnings,
                    current_app.config.get("HUAWEI_FIREWALL_MEMBER_B_NAME") or "FW2",
                ),
            },
        ],
        "configuration_warnings": configuration_warnings,
    }


def build_core_member_nodes(core_ip, members):
    if not members:
        node = build_core_node(node_id("core", core_ip), "核心交换机", core_ip)
        return [node], {}
    nodes = []
    by_slot = {}
    for member in members:
        slot = str(member.get("slot") or "").strip()
        member_id = node_id("core", f"{core_ip}-{slot or len(nodes)}")
        node = build_core_node(member_id, member.get("name") or f"核心成员 {slot}", core_ip)
        node.update({"stack_member": slot, "stack_group": "核心堆叠"})
        nodes.append(node)
        by_slot[slot] = member_id
    return nodes, by_slot


def build_core_node(core_id, name, core_ip):
    return {
        "id": core_id,
        "type": "core",
        "name": name,
        "ip": core_ip,
        "chassis_id": "",
        "vendor": "huawei",
        "model": "核心堆叠成员",
    }


def core_node_id_for_interface(interface, core_by_slot, fallback_id):
    match = re.match(r"(?i)^(?:GigabitEthernet|GE)(\d+)/", canonical_interface_name(interface))
    return core_by_slot.get(match.group(1), fallback_id) if match else fallback_id


def canonical_interface_name(interface):
    value = compact_interface_name(interface)
    return re.sub(r"(?i)^GE(?=\d)", "GigabitEthernet", value)


def parse_configured_core_links(value, warnings=None, member_name="防火墙成员"):
    links = []
    seen_local_interfaces = set()
    for item in str(value or "").split(","):
        item = item.strip()
        if not item:
            continue
        if "=" not in item:
            if warnings is not None:
                warnings.append(f"{member_name} 端口表格式错误：{item}")
            continue
        local_interface, remote_interface = item.split("=", 1)
        local_interface = canonical_interface_name(local_interface.strip())
        remote_interface = canonical_interface_name(remote_interface.strip())
        if not local_interface or not remote_interface:
            if warnings is not None:
                warnings.append(f"{member_name} 端口表缺少核心端口或防火墙端口：{item}")
            continue
        if local_interface in seen_local_interfaces:
            if warnings is not None:
                warnings.append(f"{member_name} 端口表重复配置核心端口 {local_interface}")
            continue
        seen_local_interfaces.add(local_interface)
        links.append({
            "local_interface": local_interface,
            "remote_interface": remote_interface,
        })
    return links


def add_configured_carrier_topology(
    nodes_by_key,
    edges_by_key,
    core_nodes,
    core_by_slot,
    carrier_links,
    warnings,
):
    bindings = {}
    for carrier in carrier_links:
        local_interface = canonical_interface_name(carrier.get("local_interface"))
        if not local_interface:
            continue
        if local_interface in bindings:
            warnings.append(f"运营商线路端口重复配置：{local_interface}")
            continue
        carrier_key = carrier.get("key") or local_interface
        carrier_name = carrier.get("name") or "运营商线路"
        target_id = node_id("uplink", carrier_key)
        node = nodes_by_key.setdefault(target_id, {
            "id": target_id,
            "type": "uplink",
            "name": carrier_name,
            "ip": "",
            "chassis_id": "",
            "vendor": "unknown",
            "model": "",
            "carrier_line": True,
            "configured_local_interface": local_interface,
            "device_name": "",
            "lldp_observed": False,
        })
        source_id = core_node_id_for_interface(local_interface, core_by_slot, core_nodes[0]["id"])
        edge_key = f"{source_id}--{target_id}"
        link = {
            "local_interface": local_interface,
            "remote_interface": "",
            "source": "configured",
            "observed": False,
            "observed_remote_interface": "",
        }
        edge = edges_by_key.setdefault(edge_key, {
            "id": edge_key,
            "source": source_id,
            "target": target_id,
            "links": [link],
            "relationship_source": "configured",
            "relationship_type": "carrier",
        })
        bindings[local_interface] = {"node": node, "edge": edge, "link": link}
    return bindings


def apply_carrier_neighbor(binding, neighbor):
    node = binding["node"]
    node.update({
        "ip": neighbor.get("management_ip") or node.get("ip") or "",
        "chassis_id": neighbor.get("chassis_id") or node.get("chassis_id") or "",
        "vendor": neighbor.get("platform") or node.get("vendor") or "unknown",
        "model": neighbor.get("system_description") or node.get("model") or "",
        "device_name": neighbor.get("system_name") or node.get("device_name") or "",
        "lldp_observed": True,
    })
    binding["link"].update({
        "observed": True,
        "observed_remote_interface": canonical_interface_name(neighbor.get("remote_interface")),
    })


def add_firewall_ha_topology(
    nodes_by_key,
    edges_by_key,
    core_nodes,
    core_by_slot,
    firewall_neighbors,
    firewall_members,
    firewall_target,
    ha_mode,
    warnings,
):
    observed_by_local = {
        canonical_interface_name(neighbor.get("local_interface")): neighbor
        for neighbor in firewall_neighbors
        if neighbor.get("local_interface")
    }
    mapped_local_interfaces = set()
    member_names_by_local = {}
    for member in firewall_members:
        member_name = member.get("name") or "防火墙成员"
        for configured_link in member.get("links") or []:
            local_interface = canonical_interface_name(configured_link.get("local_interface"))
            if local_interface:
                member_names_by_local.setdefault(local_interface, set()).add(member_name)
    conflicting_local_interfaces = {
        local_interface
        for local_interface, member_names in member_names_by_local.items()
        if len(member_names) > 1
    }
    for local_interface in sorted(conflicting_local_interfaces):
        member_names = "、".join(sorted(member_names_by_local[local_interface]))
        warnings.append(
            f"防火墙端口表冲突：核心端口 {local_interface} 同时配置到 {member_names}，LLDP 观测未用于确认成员"
        )
    model = next((item.get("system_description") for item in firewall_neighbors if item.get("system_description")), "")
    chassis_id = next((item.get("chassis_id") for item in firewall_neighbors if item.get("chassis_id")), "")

    for member in firewall_members:
        member_id = node_id("firewall", member.get("key") or member.get("name"))
        nodes_by_key[member_id] = {
            "id": member_id,
            "type": "firewall",
            "name": member.get("name") or "防火墙成员",
            "ip": member.get("ip") or "",
            "chassis_id": chassis_id,
            "vendor": "huawei",
            "model": model or "Huawei USG HA",
            "ha_mode": ha_mode,
            "ha_member": True,
            "cluster_target": firewall_target,
            "lldp_observed": bool(firewall_neighbors),
        }
        for configured_link in member.get("links") or []:
            local_interface = canonical_interface_name(configured_link.get("local_interface"))
            observed = (
                None
                if local_interface in conflicting_local_interfaces
                else observed_by_local.get(local_interface)
            )
            mapped_local_interfaces.add(local_interface)
            source_id = core_node_id_for_interface(local_interface, core_by_slot, core_nodes[0]["id"])
            edge_key = f"{source_id}--{member_id}"
            edge = edges_by_key.setdefault(edge_key, {
                "id": edge_key,
                "source": source_id,
                "target": member_id,
                "links": [],
                "relationship_source": "configured",
            })
            edge["links"].append({
                "local_interface": local_interface,
                "remote_interface": configured_link.get("remote_interface") or "",
                "source": "configured",
                "observed": bool(observed),
                "observed_remote_interface": (
                    canonical_interface_name(observed.get("remote_interface")) if observed else ""
                ),
            })

    for local_interface in sorted(set(observed_by_local) - mapped_local_interfaces):
        warnings.append(f"防火墙 LLDP 端口 {local_interface} 尚未配置到 FW1/FW2")


def unresolved_neighbor_macs(neighbors, config):
    return {
        neighbor.get("chassis_mac")
        for neighbor in neighbors
        if neighbor.get("chassis_mac") and not valid_neighbor_management_ip(neighbor, config)
    }


def resolve_neighbor_management_ips(neighbors, arp_output, config):
    target_macs = unresolved_neighbor_macs(neighbors, config)
    entries = parse_arp_entries_by_macs(arp_output, target_macs)
    ip_by_mac = {
        entry.get("mac"): entry.get("ip")
        for entry in entries
        if is_expected_switch_management_ip(entry.get("ip"), config)
    }
    for neighbor in neighbors:
        if valid_neighbor_management_ip(neighbor, config):
            continue
        neighbor["lldp_management_ip"] = neighbor.get("management_ip") or ""
        neighbor["management_ip"] = ip_by_mac.get(neighbor.get("chassis_mac"), "")
        if neighbor["management_ip"]:
            neighbor["management_ip_source"] = "arp"
    return neighbors


def valid_neighbor_management_ip(neighbor, config):
    management_ip = neighbor.get("management_ip") or ""
    return (
        is_expected_switch_management_ip(management_ip, config)
        and not is_known_fake_management_ip(management_ip)
    )


def hydrate_topology(snapshot, switch_targets, firewall_status, device_index):
    target_by_ip = {
        target_host(item.get("instance") or item.get("target")): item
        for item in switch_targets
        if target_host(item.get("instance") or item.get("target"))
    }
    nodes = []
    status_by_id = {}
    for raw_node in snapshot.get("nodes") or []:
        node = dict(raw_node)
        if node.get("type") == "firewall":
            apply_firewall_status(node, firewall_status)
        elif node.get("type") == "uplink":
            apply_lldp_neighbor_status(node)
        else:
            apply_switch_status(node, target_by_ip.get(node.get("ip")))
        status_by_id[node["id"]] = node.get("status")
        nodes.append(node)

    edges = []
    for raw_edge in snapshot.get("edges") or []:
        edge = dict(raw_edge)
        status = edge_status(
            status_by_id.get(edge.get("source")),
            status_by_id.get(edge.get("target")),
        )
        if (
            edge.get("relationship_source") == "configured"
            and not edge.get("observed_link_count")
            and status != "offline"
        ):
            status = "unknown"
        edge["status"] = status
        edges.append(edge)

    switch_nodes = [node for node in nodes if node.get("type") in {"core", "switch"}]
    return {
        **snapshot,
        "nodes": nodes,
        "edges": edges,
        "devices": device_index,
        "stats": {
            "switch_total": len(switch_nodes),
            "switch_online": sum(1 for node in switch_nodes if node.get("status") == "online"),
            "switch_offline": sum(1 for node in switch_nodes if node.get("status") == "offline"),
            "switch_unknown": sum(1 for node in switch_nodes if node.get("status") in {"unknown", "unconfigured"}),
            "firewall_total": sum(1 for node in nodes if node.get("type") == "firewall"),
            "link_total": sum(int(edge.get("link_count") or 0) for edge in edges),
        },
    }


def apply_switch_status(node, target):
    if not node.get("ip"):
        node.update({"status": "unknown", "status_text": "状态未知", "status_source": "LLDP"})
        return
    if not target:
        node.update({"status": "unknown", "status_text": "未纳入监控", "status_source": "Prometheus"})
        return
    online = bool(target.get("is_online"))
    node.update({
        "status": "online" if online else "offline",
        "status_text": "在线" if online else "离线",
        "status_source": "Prometheus",
        "last_checked_at": target.get("last_scrape_at") or "",
        "last_error": target.get("last_error") or "",
    })


def apply_lldp_neighbor_status(node):
    observed = bool(node.get("lldp_observed"))
    node.update({
        "status": "online" if observed else "unknown",
        "status_text": "链路已连接" if observed else "等待 LLDP",
        "status_source": "核心 LLDP",
    })


def apply_firewall_status(node, firewall_status):
    if not firewall_status.get("configured"):
        status = "unconfigured"
        status_text = "SNMP 未配置"
    elif firewall_status.get("ok"):
        status = "online"
        status_text = "集群可达" if node.get("ha_member") else "在线"
    else:
        status = "offline"
        status_text = "集群采集异常" if node.get("ha_member") else "采集异常"
    node.update({
        "status": status,
        "status_text": status_text,
        "status_source": "SNMP 集群" if node.get("ha_member") else "SNMP",
        "cpu_usage": firewall_status.get("cpu_usage", 0),
        "memory_usage": firewall_status.get("memory_usage", 0),
        "last_error": firewall_status.get("error") or "",
    })


def edge_status(source_status, target_status):
    statuses = {source_status, target_status}
    if "offline" in statuses:
        return "offline"
    if statuses <= {"online"}:
        return "online"
    return "unknown"


def read_topology_cache():
    path = topology_cache_path()
    try:
        with open(path, "r", encoding="utf-8") as handle:
            payload = json.load(handle)
    except (OSError, ValueError, TypeError):
        return None
    if payload.get("version") != TOPOLOGY_CACHE_VERSION:
        return None
    return payload


def write_topology_cache(snapshot):
    path = topology_cache_path()
    os.makedirs(os.path.dirname(path) or current_app.instance_path, exist_ok=True)
    temp_path = f"{path}.{os.getpid()}.tmp"
    with open(temp_path, "w", encoding="utf-8") as handle:
        json.dump(snapshot, handle, ensure_ascii=False, separators=(",", ":"))
    os.replace(temp_path, path)


def cache_is_fresh(snapshot, now=None):
    generated = float(snapshot.get("generated_timestamp") or 0)
    return generated > 0 and (now or time.time()) - generated < topology_cache_seconds()


def topology_cache_seconds():
    return max(30, int(current_app.config.get("SWITCH_TOPOLOGY_CACHE_SECONDS", 300)))


def topology_force_refresh_cooldown_seconds():
    return max(15, int(current_app.config.get(
        "SWITCH_TOPOLOGY_FORCE_REFRESH_COOLDOWN_SECONDS",
        60,
    )))


def force_refresh_cooldown_meta(snapshot, now=None):
    generated = float(snapshot.get("generated_timestamp") or 0)
    if generated <= 0:
        return None
    remaining = topology_force_refresh_cooldown_seconds() - ((now or time.time()) - generated)
    if remaining <= 0:
        return None
    return cache_meta(cached=True, rate_limited=True, retry_after=max(1, int(remaining + 0.999)))


def topology_discovery_retry_after(now=None):
    attempted_at = read_topology_discovery_attempt()
    if attempted_at <= 0:
        return 0
    remaining = topology_force_refresh_cooldown_seconds() - ((now or time.time()) - attempted_at)
    return max(0, int(remaining + 0.999))


def topology_discovery_attempt_path():
    return f"{topology_cache_path()}.refresh"


def read_topology_discovery_attempt():
    try:
        with open(topology_discovery_attempt_path(), "r", encoding="utf-8") as handle:
            return float(json.load(handle).get("attempted_at") or 0)
    except (OSError, ValueError, TypeError, AttributeError):
        return 0


def write_topology_discovery_attempt(attempted_at=None):
    path = topology_discovery_attempt_path()
    os.makedirs(os.path.dirname(path) or current_app.instance_path, exist_ok=True)
    temp_path = f"{path}.{os.getpid()}.tmp"
    with open(temp_path, "w", encoding="utf-8") as handle:
        json.dump({"attempted_at": attempted_at or time.time()}, handle, separators=(",", ":"))
    os.replace(temp_path, path)


def cache_meta(cached, stale=False, error="", rate_limited=False, retry_after=0):
    return {
        "cached": cached,
        "stale": stale,
        "error": error,
        "rate_limited": rate_limited,
        "retry_after": retry_after,
    }


def topology_cache_path():
    configured = current_app.config.get("SWITCH_TOPOLOGY_CACHE_FILE")
    return configured or os.path.join(current_app.instance_path, "switch_topology.json")


@contextmanager
def topology_cache_lock():
    with _cache_lock:
        lock_path = f"{topology_cache_path()}.lock"
        os.makedirs(os.path.dirname(lock_path) or current_app.instance_path, exist_ok=True)
        with open(lock_path, "a+", encoding="utf-8") as handle:
            try:
                import fcntl

                fcntl.flock(handle.fileno(), fcntl.LOCK_EX)
            except ImportError:
                pass
            try:
                yield
            finally:
                try:
                    import fcntl

                    fcntl.flock(handle.fileno(), fcntl.LOCK_UN)
                except ImportError:
                    pass


def match_line(text, label):
    match = re.search(rf"(?im)^\s*{re.escape(label)}\s*:\s*(.*?)\s*$", str(text or ""))
    return match.group(1).strip() if match else ""


def node_id(node_type, value):
    normalized = re.sub(r"[^a-z0-9]+", "-", str(value or "unknown").strip().lower()).strip("-")
    return f"{node_type}:{normalized or 'unknown'}"


def topology_node_sort_key(node):
    type_order = {"uplink": 0, "firewall": 1, "core": 2, "switch": 3}
    return type_order.get(node.get("type"), 9), node.get("name") or node.get("ip") or ""


def target_host(value):
    text = str(value or "").strip()
    if text.startswith("[") and "]" in text:
        return text[1:text.index("]")]
    if text.count(":") == 1:
        return text.split(":", 1)[0]
    return text
