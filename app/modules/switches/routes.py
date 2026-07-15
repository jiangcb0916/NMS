from datetime import datetime
import re
import time

from flask import Blueprint, current_app, request
from flask_login import login_required

from app.common.responses import failure, success
from app.common.validators import validate_ip, validate_mac
from app.models.device import Device
from app.modules.integrations.prometheus import PrometheusClient
from app.modules.switches.trace import normalize_mac, trace_terminal_ip, trace_terminal_mac


switch_bp = Blueprint("switch_api", __name__)

SWITCH_TRAFFIC_RANGES = {
    "5m": 5 * 60,
    "15m": 15 * 60,
    "30m": 30 * 60,
    "1h": 60 * 60,
    "3h": 3 * 60 * 60,
    "6h": 6 * 60 * 60,
    "12h": 12 * 60 * 60,
    "24h": 24 * 60 * 60,
}


@switch_bp.route("/api/statistics/switches", methods=["GET"])
@login_required
def switch_list():
    client = PrometheusClient()
    if not client.targets_configured:
        return success(empty_switch_payload(configured=False), message="Prometheus targets 接口未配置", code=1)

    page = int_arg("page", default=1, minimum=1, maximum=100000)
    per_page = int_arg("per_page", default=10, minimum=10, maximum=500)
    search = (request.args.get("q") or "").strip().lower()
    vendor = (request.args.get("vendor") or "").strip().lower()
    status = normalize_switch_status(request.args.get("status"))

    targets = build_switch_targets(client)
    vendor_counts = switch_vendor_counts(filter_switches(targets, search=search, vendor="", status=""))
    status_counts = switch_status_counts(filter_switches(targets, search=search, vendor=vendor, status=""))
    filtered = filter_switches(targets, search=search, vendor=vendor, status=status)
    total = len(filtered)
    pages = (total + per_page - 1) // per_page if total else 0
    if pages and page > pages:
        page = pages

    start = (page - 1) * per_page
    page_items = filtered[start:start + per_page]
    return success({
        "switch_list": page_items,
        "total": total,
        "all_total": len(targets),
        "online_count": status_counts["online"],
        "offline_count": status_counts["offline"],
        "avg_scrape_duration": avg_scrape_duration(filtered),
        "returned": len(page_items),
        "page": page,
        "per_page": per_page,
        "pages": pages,
        "q": search,
        "vendor": vendor,
        "status": status,
        "status_counts": status_counts,
        "vendor_counts": vendor_counts,
        "configured": True,
        "job": switch_job(),
        "target_group": current_app.config.get("SWITCH_TARGET_GROUP", ""),
    })


@switch_bp.route("/api/statistics/switches/<path:instance>/ports", methods=["GET"])
@login_required
def switch_ports(instance):
    client = PrometheusClient()
    rate_window = normalize_rate_window(request.args.get("rate_window"))
    if not client.query_configured:
        return success(empty_switch_ports_payload(instance, rate_window, configured=False), message="Prometheus 查询接口未配置", code=1)

    search = (request.args.get("q") or "").strip().lower()
    status = normalize_port_status(request.args.get("status"))
    scope = normalize_port_scope(request.args.get("scope"))
    sort_by = normalize_port_sort(request.args.get("sort_by"))
    sort_order = normalize_sort_order(request.args.get("sort_order"))
    page = int_arg("page", default=1, minimum=1, maximum=100000)
    per_page = int_arg("per_page", default=10, minimum=10, maximum=500)

    try:
        all_ports = build_switch_ports(client, instance, rate_window)
    except Exception as exc:
        current_app.logger.warning("switch port query failed: %s", exc.__class__.__name__)
        return success(empty_switch_ports_payload(instance, rate_window, configured=True), message="交换机端口数据查询失败", code=1)

    scoped_ports = filter_switch_port_scope(all_ports, scope)
    filtered = filter_switch_ports(scoped_ports, search=search, status=status)
    filtered = sort_switch_ports(filtered, sort_by=sort_by, sort_order=sort_order)
    summary = switch_ports_summary(filtered)
    total = len(filtered)
    pages = (total + per_page - 1) // per_page if total else 0
    if pages and page > pages:
        page = pages
    start = (page - 1) * per_page
    page_items = filtered[start:start + per_page]
    return success({
        "instance": instance,
        "ports": page_items,
        "total": total,
        "scoped_total": len(scoped_ports),
        "all_total": len(all_ports),
        "hidden_total": len(all_ports) - len(scoped_ports),
        "returned": len(page_items),
        "page": page,
        "per_page": per_page,
        "pages": pages,
        "summary": summary,
        "q": search,
        "status": status,
        "scope": scope,
        "sort_by": sort_by,
        "sort_order": sort_order,
        "rate_window": rate_window,
        "configured": True,
        "job": switch_job(),
        "queried_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
    })


@switch_bp.route("/api/statistics/switches/<path:instance>/traffic-history", methods=["GET"])
@login_required
def switch_traffic_history(instance):
    client = PrometheusClient()
    range_key = normalize_traffic_range(request.args.get("range"))
    range_seconds = SWITCH_TRAFFIC_RANGES[range_key]
    rate_window = normalize_rate_window(request.args.get("rate_window"))
    scope = normalize_port_scope(request.args.get("scope"))
    if not client.query_configured:
        return success(empty_switch_traffic_payload(instance, range_key, range_seconds, rate_window, configured=False), message="Prometheus 查询接口未配置", code=1)

    end = int(time.time())
    start = end - range_seconds
    step = int_arg("step", default=traffic_range_step(range_seconds), minimum=15, maximum=3600)

    try:
        samples = build_switch_traffic_samples(client, instance, rate_window, start, end, step, scope)
    except Exception as exc:
        current_app.logger.warning("switch traffic history query failed: %s", exc.__class__.__name__)
        return success(empty_switch_traffic_payload(instance, range_key, range_seconds, rate_window, configured=True), message="交换机流量趋势查询失败", code=1)

    latest = samples[-1] if samples else {}
    return success({
        "instance": instance,
        "samples": samples,
        "sample_count": len(samples),
        "latest": latest,
        "range": range_key,
        "range_seconds": range_seconds,
        "rate_window": rate_window,
        "scope": scope,
        "step": step,
        "configured": True,
        "job": switch_job(),
        "queried_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
    })


@switch_bp.route("/api/statistics/switches/trace-terminal", methods=["POST"])
@login_required
def switch_trace_terminal():
    data = request.get_json(silent=True) or {}
    try:
        target_type, target_value = parse_trace_target(data)
    except ValueError as exc:
        return failure(str(exc), status=400)

    if target_type == "mac":
        payload, message, code = trace_terminal_mac(target_value)
        payload["target_name"] = trace_target_name(target_mac=target_value)
    else:
        payload, message, code = trace_terminal_ip(target_value)
        payload["target_name"] = trace_target_name(target_ip=target_value)
    return success(payload, message=message, code=code)


def parse_trace_target(data):
    raw_target = data.get("target")
    if raw_target is None or str(raw_target).strip() == "":
        raw_target = data.get("mac") or data.get("ip")
    target = str(raw_target or "").strip()
    if not target:
        raise ValueError("终端 IP 或 MAC 不能为空")

    try:
        return "ip", validate_ip(target, "终端 IP")
    except ValueError:
        try:
            return "mac", normalize_mac(validate_mac(target, "终端 MAC"))
        except ValueError as exc:
            raise ValueError("终端地址格式不正确，请输入 IPv4 或 MAC 地址") from exc


def trace_target_name(target_ip="", target_mac=""):
    if target_ip:
        device = Device.query.filter_by(ip_address=target_ip).first()
        return device.username if device else "无"

    normalized_target = normalize_mac(target_mac)
    if not normalized_target:
        return "无"
    devices = Device.query.filter(Device.mac_address.isnot(None)).all()
    device = next(
        (item for item in devices if normalize_mac(item.mac_address) == normalized_target),
        None,
    )
    return device.username if device else "无"


def build_switch_targets(client=None):
    client = client or PrometheusClient()
    targets = client.targets(state="active")
    rows = [
        normalize_switch_target(target)
        for target in targets
        if target.get("labels", {}).get("job") == switch_job()
    ]
    return sorted(rows, key=lambda item: ip_sort_key(item["instance"]))


def build_switch_ports(client, instance, rate_window):
    selector = switch_metric_selector(instance)
    queries = {
        "in_bps": f"rate(ifHCInOctets{selector}[{rate_window}]) * 8",
        "out_bps": f"rate(ifHCOutOctets{selector}[{rate_window}]) * 8",
        "in_errors": f"ifInErrors{selector}",
        "out_errors": f"ifOutErrors{selector}",
    }
    ports = {}
    for field, expression in queries.items():
        for result in client.query(expression):
            labels = result.get("metric") or {}
            key = switch_port_key(labels)
            if not key:
                continue
            port = ports.setdefault(key, base_switch_port(labels))
            merge_switch_port_labels(port, labels)
            port[field] = numeric_result_value(result)

    normalized = [finalize_switch_port(port) for port in ports.values()]
    return sorted(normalized, key=lambda item: port_sort_key(item, "index"))


def build_switch_traffic_samples(client, instance, rate_window, start, end, step, scope="business"):
    selector = switch_metric_selector(instance, exclude_unnecessary=scope != "all")
    in_query = f"sum(rate(ifHCInOctets{selector}[{rate_window}]) * 8)"
    out_query = f"sum(rate(ifHCOutOctets{selector}[{rate_window}]) * 8)"
    in_points = range_points(client.query_range(in_query, start=start, end=end, step=step))
    out_points = range_points(client.query_range(out_query, start=start, end=end, step=step))
    samples = []
    for timestamp in sorted(set(in_points.keys()) | set(out_points.keys())):
        in_bps = in_points.get(timestamp, 0)
        out_bps = out_points.get(timestamp, 0)
        samples.append({
            "timestamp": timestamp,
            "time": format_unix_time(timestamp),
            "total_in_bps": round(in_bps, 2),
            "total_out_bps": round(out_bps, 2),
            "total_in_mbps": round(in_bps / 1_000_000, 3),
            "total_out_mbps": round(out_bps / 1_000_000, 3),
            "total_in_rate": format_bps(in_bps),
            "total_out_rate": format_bps(out_bps),
        })
    return samples


def normalize_switch_target(target):
    labels = target.get("labels") or {}
    discovered = target.get("discoveredLabels") or {}
    instance = labels.get("instance") or discovered.get("__address__") or "N/A"
    vendor = labels.get("auth") or discovered.get("auth") or "unknown"
    module = labels.get("module") or discovered.get("module") or "N/A"
    health = (target.get("health") or "unknown").lower()
    duration = float_value(target.get("lastScrapeDuration"))
    last_error = target.get("lastError") or ""
    return {
        "instance": instance,
        "target": discovered.get("__address__") or instance,
        "vendor": vendor,
        "module": module,
        "job": labels.get("job") or discovered.get("job") or "",
        "scrape_pool": target.get("scrapePool") or "",
        "health": health,
        "is_online": health == "up",
        "last_scrape": target.get("lastScrape") or "",
        "last_scrape_at": format_prometheus_time(target.get("lastScrape")),
        "scrape_duration": duration,
        "scrape_duration_text": format_seconds(duration),
        "scrape_interval": target.get("scrapeInterval") or "",
        "scrape_timeout": target.get("scrapeTimeout") or "",
        "last_error": last_error,
        "has_error": bool(last_error),
    }


def base_switch_port(labels):
    return {
        "instance": labels.get("instance") or "",
        "if_index": labels.get("ifIndex") or "",
        "if_name": labels.get("ifName") or labels.get("ifDescr") or "",
        "if_alias": labels.get("ifAlias") or "",
        "if_high_speed_mbps": numeric_label(labels.get("ifHighSpeed")),
        "oper_status": labels.get("ifOperStatus") or "",
        "in_bps": 0,
        "out_bps": 0,
        "in_errors": 0,
        "out_errors": 0,
    }


def merge_switch_port_labels(port, labels):
    if not port.get("instance"):
        port["instance"] = labels.get("instance") or ""
    if not port.get("if_index"):
        port["if_index"] = labels.get("ifIndex") or ""
    if not port.get("if_name"):
        port["if_name"] = labels.get("ifName") or labels.get("ifDescr") or ""
    if not port.get("if_alias"):
        port["if_alias"] = labels.get("ifAlias") or ""
    if not port.get("oper_status"):
        port["oper_status"] = labels.get("ifOperStatus") or ""
    if not port.get("if_high_speed_mbps"):
        port["if_high_speed_mbps"] = numeric_label(labels.get("ifHighSpeed"))


def finalize_switch_port(port):
    in_bps = max(0, float_value(port.get("in_bps")))
    out_bps = max(0, float_value(port.get("out_bps")))
    total_bps = in_bps + out_bps
    high_speed_mbps = numeric_label(port.get("if_high_speed_mbps"))
    speed_bps = high_speed_mbps * 1_000_000 if high_speed_mbps else 0
    utilization = round((max(in_bps, out_bps) / speed_bps) * 100, 2) if speed_bps else 0
    oper_status = str(port.get("oper_status") or "")
    is_online = oper_status == "1"
    return {
        "instance": port.get("instance") or "",
        "if_index": str(port.get("if_index") or ""),
        "if_name": port.get("if_name") or f"ifIndex {port.get('if_index') or '-'}",
        "if_alias": port.get("if_alias") or "",
        "if_high_speed_mbps": high_speed_mbps,
        "speed_bps": round(speed_bps, 2),
        "speed_text": format_speed_mbps(high_speed_mbps),
        "oper_status": oper_status,
        "oper_status_text": render_oper_status(oper_status),
        "is_online": is_online,
        "in_bps": round(in_bps, 2),
        "out_bps": round(out_bps, 2),
        "total_bps": round(total_bps, 2),
        "in_rate": format_bps(in_bps),
        "out_rate": format_bps(out_bps),
        "total_rate": format_bps(total_bps),
        "utilization": utilization,
        "utilization_text": f"{utilization:.2f}%" if speed_bps else "-",
        "in_errors": int(round(float_value(port.get("in_errors")))),
        "out_errors": int(round(float_value(port.get("out_errors")))),
    }


def filter_switch_ports(ports, search="", status=""):
    result = []
    for port in ports:
        if status == "online" and not port.get("is_online"):
            continue
        if status == "offline" and port.get("is_online"):
            continue
        if search and not switch_port_matches(port, search):
            continue
        result.append(port)
    return result


def filter_switch_port_scope(ports, scope="business"):
    if scope == "all":
        return list(ports)
    return [port for port in ports if not is_unnecessary_switch_port(port)]


def is_unnecessary_switch_port(port):
    name = str(port.get("if_name") or "")
    for pattern in switch_port_exclude_patterns():
        try:
            if re.search(pattern, name, re.IGNORECASE):
                return True
        except re.error:
            current_app.logger.warning("invalid switch port exclude pattern ignored")
    return False


def switch_port_matches(port, search):
    fields = [
        port.get("if_index"),
        port.get("if_name"),
        port.get("if_alias"),
        port.get("oper_status_text"),
        port.get("speed_text"),
    ]
    return any(search in str(value).lower() for value in fields if value)


def sort_switch_ports(ports, sort_by="traffic", sort_order="desc"):
    return sorted(ports, key=lambda item: port_sort_key(item, sort_by), reverse=sort_order == "desc")


def port_sort_key(port, sort_by):
    if sort_by == "name":
        return str(port.get("if_name") or "").lower()
    if sort_by == "status":
        return (1 if port.get("is_online") else 0, str(port.get("if_name") or "").lower())
    if sort_by == "in":
        return float_value(port.get("in_bps"))
    if sort_by == "out":
        return float_value(port.get("out_bps"))
    if sort_by == "utilization":
        return float_value(port.get("utilization"))
    if sort_by == "errors":
        return int(port.get("in_errors") or 0) + int(port.get("out_errors") or 0)
    if sort_by == "index":
        index = port.get("if_index")
        return int(index) if str(index).isdigit() else 999999
    return float_value(port.get("total_bps"))


def switch_ports_summary(ports):
    total_in = sum(float_value(port.get("in_bps")) for port in ports)
    total_out = sum(float_value(port.get("out_bps")) for port in ports)
    online = sum(1 for port in ports if port.get("is_online"))
    busiest = max(ports, key=lambda port: float_value(port.get("total_bps")), default=None)
    return {
        "port_count": len(ports),
        "online_count": online,
        "offline_count": len(ports) - online,
        "total_in_bps": round(total_in, 2),
        "total_out_bps": round(total_out, 2),
        "total_in_mbps": round(total_in / 1_000_000, 3),
        "total_out_mbps": round(total_out / 1_000_000, 3),
        "total_in_rate": format_bps(total_in),
        "total_out_rate": format_bps(total_out),
        "busiest_port": busiest,
    }


def filter_switches(items, search="", vendor="", status=""):
    result = []
    for item in items:
        if vendor and item.get("vendor", "").lower() != vendor:
            continue
        if status == "online" and not item.get("is_online"):
            continue
        if status == "offline" and item.get("is_online"):
            continue
        if search and not switch_matches(item, search):
            continue
        result.append(item)
    return result


def switch_matches(item, search):
    fields = [
        item.get("instance"),
        item.get("target"),
        item.get("vendor"),
        item.get("module"),
        item.get("health"),
        item.get("scrape_pool"),
        item.get("last_error"),
    ]
    return any(search in str(value).lower() for value in fields if value)


def switch_status_counts(items):
    online = sum(1 for item in items if item.get("is_online"))
    total = len(items)
    return {
        "all": total,
        "online": online,
        "offline": total - online,
    }


def switch_vendor_counts(items):
    counts = {}
    for item in items:
        vendor = item.get("vendor") or "unknown"
        counts[vendor] = counts.get(vendor, 0) + 1
    return counts


def avg_scrape_duration(items):
    durations = [item["scrape_duration"] for item in items if item.get("scrape_duration") is not None]
    if not durations:
        return 0
    return round(sum(durations) / len(durations), 3)


def normalize_switch_status(value):
    status = (value or "").strip().lower()
    if status in {"online", "up", "1", "true"}:
        return "online"
    if status in {"offline", "down", "0", "false"}:
        return "offline"
    return ""


def normalize_port_status(value):
    status = (value or "").strip().lower()
    if status in {"online", "up", "1", "true"}:
        return "online"
    if status in {"offline", "down", "2", "0", "false"}:
        return "offline"
    return ""


def normalize_port_scope(value):
    scope = (value or "business").strip().lower()
    return "all" if scope == "all" else "business"


def normalize_port_sort(value):
    sort_by = (value or "traffic").strip().lower()
    allowed = {"traffic", "name", "index", "status", "in", "out", "utilization", "errors"}
    return sort_by if sort_by in allowed else "traffic"


def normalize_sort_order(value):
    return "asc" if (value or "").strip().lower() == "asc" else "desc"


def normalize_traffic_range(value):
    key = (value or "1h").strip().lower()
    return key if key in SWITCH_TRAFFIC_RANGES else "1h"


def normalize_rate_window(value):
    fallback = current_app.config.get("SWITCH_TRAFFIC_RATE_WINDOW", "5m")
    candidate = (value or fallback or "5m").strip().lower()
    if re.fullmatch(r"[1-9]\d*[smhdw]", candidate):
        return candidate
    fallback = str(fallback or "5m").strip().lower()
    if re.fullmatch(r"[1-9]\d*[smhdw]", fallback):
        return fallback
    return "5m"


def switch_job():
    return current_app.config.get("SWITCH_PROMETHEUS_JOB", "sw")


def switch_port_exclude_patterns():
    raw = current_app.config.get("SWITCH_PORT_EXCLUDE_PATTERNS", "")
    if isinstance(raw, (list, tuple)):
        return [str(item).strip() for item in raw if str(item).strip()]
    return [item.strip() for item in str(raw or "").split(",") if item.strip()]


def switch_metric_selector(instance, exclude_unnecessary=False):
    matchers = [
        f'job="{promql_label_value(switch_job())}"',
        f'instance="{promql_label_value(instance)}"',
    ]
    exclude_regex = switch_port_exclude_regex() if exclude_unnecessary else ""
    if exclude_regex:
        matchers.append(f'ifName!~"{promql_label_value(exclude_regex)}"')
    return "{" + ",".join(matchers) + "}"


def promql_label_value(value):
    return str(value or "").replace("\\", "\\\\").replace('"', '\\"').replace("\n", "")


def switch_port_exclude_regex():
    patterns = switch_port_exclude_patterns()
    return "|".join(f"(?:{pattern})" for pattern in patterns)


def switch_port_key(labels):
    return labels.get("ifIndex") or labels.get("ifName") or labels.get("ifDescr") or labels.get("ifAlias")


def int_arg(name, default, minimum, maximum):
    value = request.args.get(name)
    try:
        parsed = int(value) if value is not None else default
    except (TypeError, ValueError):
        parsed = default
    return max(minimum, min(maximum, parsed))


def float_value(value):
    try:
        return round(float(value), 3)
    except (TypeError, ValueError):
        return 0


def numeric_label(value):
    try:
        return float(value)
    except (TypeError, ValueError):
        return 0


def numeric_result_value(result):
    try:
        value = result.get("value", [None, 0])[1]
    except (AttributeError, IndexError, TypeError):
        value = 0
    return float_value(value)


def range_points(results):
    points = {}
    if not results:
        return points
    for result in results:
        for raw_timestamp, raw_value in result.get("values") or []:
            try:
                timestamp = int(float(raw_timestamp))
                points[timestamp] = float(raw_value)
            except (TypeError, ValueError):
                continue
    return points


def traffic_range_step(range_seconds):
    if range_seconds <= 30 * 60:
        return 30
    if range_seconds <= 3 * 60 * 60:
        return 60
    if range_seconds <= 12 * 60 * 60:
        return 300
    return 600


def format_seconds(value):
    number = float_value(value)
    if number >= 1:
        return f"{number:.2f}s"
    return f"{number * 1000:.0f}ms"


def format_bps(value):
    bps = max(0, float_value(value))
    if bps >= 1_000_000_000:
        return f"{bps / 1_000_000_000:.2f} Gbps"
    if bps >= 1_000_000:
        return f"{bps / 1_000_000:.2f} Mbps"
    if bps >= 1_000:
        return f"{bps / 1_000:.0f} Kbps"
    return f"{bps:.0f} bps"


def format_speed_mbps(value):
    mbps = numeric_label(value)
    if mbps <= 0:
        return "-"
    if mbps >= 1000:
        return f"{mbps / 1000:g} Gbps"
    return f"{mbps:g} Mbps"


def render_oper_status(value):
    labels = {
        "1": "up",
        "2": "down",
        "3": "testing",
        "4": "unknown",
        "5": "dormant",
        "6": "notPresent",
        "7": "lowerLayerDown",
    }
    return labels.get(str(value or ""), str(value or "unknown"))


def format_prometheus_time(value):
    if not value:
        return "-"
    text = re.sub(r"\.(\d{6})\d+", r".\1", str(value))
    try:
        return datetime.fromisoformat(text).strftime("%Y-%m-%d %H:%M:%S")
    except ValueError:
        return str(value)


def format_unix_time(value):
    try:
        return datetime.fromtimestamp(float(value)).strftime("%Y-%m-%d %H:%M:%S")
    except (TypeError, ValueError, OSError):
        return "-"


def ip_sort_key(value):
    parts = str(value or "").split(".")
    if len(parts) == 4 and all(part.isdigit() for part in parts):
        return tuple(int(part) for part in parts)
    return (999, 999, 999, 999, str(value or ""))


def empty_switch_payload(configured):
    return {
        "switch_list": [],
        "total": 0,
        "all_total": 0,
        "online_count": 0,
        "offline_count": 0,
        "avg_scrape_duration": 0,
        "returned": 0,
        "page": 1,
        "per_page": 10,
        "pages": 0,
        "q": "",
        "vendor": "",
        "status": "",
        "status_counts": {"all": 0, "online": 0, "offline": 0},
        "vendor_counts": {},
        "configured": configured,
        "job": switch_job(),
        "target_group": current_app.config.get("SWITCH_TARGET_GROUP", ""),
    }


def empty_switch_ports_payload(instance, rate_window, configured):
    return {
        "instance": instance,
        "ports": [],
        "total": 0,
        "scoped_total": 0,
        "all_total": 0,
        "hidden_total": 0,
        "returned": 0,
        "page": 1,
        "per_page": 10,
        "pages": 0,
        "summary": switch_ports_summary([]),
        "q": "",
        "status": "",
        "scope": "business",
        "sort_by": "traffic",
        "sort_order": "desc",
        "rate_window": rate_window,
        "configured": configured,
        "job": switch_job(),
        "queried_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
    }


def empty_switch_traffic_payload(instance, range_key, range_seconds, rate_window, configured):
    return {
        "instance": instance,
        "samples": [],
        "sample_count": 0,
        "latest": {},
        "range": range_key,
        "range_seconds": range_seconds,
        "rate_window": rate_window,
        "scope": "business",
        "step": traffic_range_step(range_seconds),
        "configured": configured,
        "job": switch_job(),
        "queried_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
    }
