import hashlib
import re
from datetime import datetime

from flask import Blueprint, current_app, request
from flask_login import login_required

from app.common.responses import success
from app.models.base import now_local
from app.models.cache import UserNameCache
from app.modules.integrations.prometheus import (
    PrometheusClient,
    hex_to_ip,
    hex_to_mac,
    hex_to_string,
    metric_value,
    parse_user_names_metrics,
)
from app.modules.integrations.dingtalk import DingTalkClient


wireless_bp = Blueprint("wireless_api", __name__)
wireless_user_cache = {
    "data": [],
    "last_update": 0,
    "cache_ttl": 5,
}


@wireless_bp.route("/api/status/wireless-controller", methods=["GET"])
@login_required
def wireless_controller():
    client = PrometheusClient()
    if not client.query_configured:
        return success(empty_wireless_data(), message="Prometheus 查询接口未配置", code=1)

    users = metric_value(client.query(wireless_query("sfUserNum")), 0)
    cpu = metric_value(client.query(wireless_query("sfSysCpuCostRate")), 0)
    ap_online = metric_value(client.query(wireless_query("sfApOnlineNum")), 0)
    ssid_stats = build_ssid_stats(client)

    return success({
        "wireless_users": int(users),
        "cpu_usage": round(cpu, 1),
        "memory_usage": 0,
        "ap_online": int(ap_online),
        "ssid_stats": ssid_stats,
        "configured": True,
    })


@wireless_bp.route("/api/statistics/wireless", methods=["GET"])
@login_required
def wireless_statistics():
    return wireless_controller()


@wireless_bp.route("/api/statistics/ap-info", methods=["GET"])
@login_required
def ap_info():
    client = PrometheusClient()
    if not client.query_configured:
        return success(empty_ap_payload(configured=False), message="Prometheus 查询接口未配置", code=1)

    page = int_arg("page", default=1, minimum=1, maximum=100000)
    per_page = int_arg("per_page", default=10, minimum=10, maximum=500)
    search = (request.args.get("q") or "").strip().lower()
    status = normalize_ap_status(request.args.get("status"))
    sort_by = normalize_ap_sort(request.args.get("sort_by"))
    sort_order = normalize_sort_order(request.args.get("sort_order"))

    ap_list = build_ap_list(client)
    status_counts = ap_status_counts(filter_aps(ap_list, search=search, status=""))
    filtered_aps = filter_aps(ap_list, search=search, status=status)
    filtered_aps = sort_aps(filtered_aps, sort_by, sort_order)
    total = len(filtered_aps)
    pages = (total + per_page - 1) // per_page if total else 0
    if pages and page > pages:
        page = pages

    start = (page - 1) * per_page
    page_aps = filtered_aps[start:start + per_page]
    return success({
        "ap_list": page_aps,
        "total_aps": total,
        "all_total_aps": len(ap_list),
        "online_aps": status_counts["online"],
        "offline_aps": status_counts["offline"],
        "total_users": sum(ap["user_count"] for ap in filtered_aps),
        "returned": len(page_aps),
        "page": page,
        "per_page": per_page,
        "pages": pages,
        "q": search,
        "status": status,
        "sort_by": sort_by,
        "sort_order": sort_order,
        "status_counts": status_counts,
        "configured": True,
    })


@wireless_bp.route("/api/statistics/online-user-list", methods=["GET"])
@login_required
def wireless_online_users():
    page = int_arg("page", default=1, minimum=1, maximum=100000)
    per_page = int_arg("per_page", default=10, minimum=10, maximum=500)
    search = (request.args.get("q") or "").strip().lower()
    resolve_names = (request.args.get("resolve_names") or "1").lower() in {"1", "true", "yes", "on"}
    sort_by = normalize_wireless_user_sort(request.args.get("sort_by"))
    sort_order = normalize_sort_order(request.args.get("sort_order"))

    users, cached, configured = get_wireless_online_users()
    if not configured:
        return success(empty_wireless_user_payload(configured=False), message="Prometheus 查询接口未配置", code=1)

    filtered_users = filter_wireless_users(users, search=search)
    filtered_users = sort_wireless_users(filtered_users, sort_by, sort_order)
    total = len(filtered_users)
    pages = (total + per_page - 1) // per_page if total else 0
    if pages and page > pages:
        page = pages

    start = (page - 1) * per_page
    page_users = filtered_users[start:start + per_page]
    if resolve_names:
        resolve_wireless_real_names(page_users)

    return success({
        "user_list": page_users,
        "total_users": total,
        "returned": len(page_users),
        "page": page,
        "per_page": per_page,
        "pages": pages,
        "q": search,
        "sort_by": sort_by,
        "sort_order": sort_order,
        "ssid": "",
        "ssids": [],
        "all_total_users": len(users),
        "cached": cached,
        "names_resolved": resolve_names,
        "configured": True,
    })


@wireless_bp.route("/api/statistics/user-names", methods=["GET"])
@login_required
def user_names():
    client = PrometheusClient()
    if not client.metrics_configured:
        return success({"user_names": {}, "configured": False}, message="Prometheus metrics 接口未配置", code=1)
    return success({"user_names": parse_user_names_metrics(client.metrics_text()), "configured": True})


@wireless_bp.route("/api/validation/wireless-user-data", methods=["GET"])
@login_required
def validate_wireless_user_data():
    users, _, configured = get_wireless_online_users()
    if not configured:
        users = []
    missing_ip = sum(1 for user in users if user.get("ip_address") == "N/A")
    return success({
        "validation": {
            "timestamp": datetime.now().isoformat(),
            "status": "success",
            "issues": [],
            "warnings": [],
            "data_quality": "good" if not missing_ip else "fair",
            "statistics": {
                "total_users": len(users),
                "empty_ips": missing_ip,
            },
        }
    })


@wireless_bp.route("/api/validation/ssid-data", methods=["GET"])
@login_required
def validate_ssid_data():
    response, _ = wireless_controller()
    data = response.get_json()["data"]
    ssid_data = data.get("ssid_stats", [])
    return success({
        "ssid_data": ssid_data,
        "validation": {
            "timestamp": datetime.now().isoformat(),
            "status": "success",
            "issues": [],
            "warnings": [],
            "data_quality": "good" if ssid_data else "poor",
        },
        "total_ssids": len(ssid_data),
        "total_users": sum(item.get("users", 0) for item in ssid_data),
    })


@wireless_bp.route("/api/validation/ssid-health", methods=["GET"])
@login_required
def ssid_health():
    response, _ = validate_ssid_data()
    validation = response.get_json()["data"]
    total_ssids = validation.get("total_ssids", 0)
    health_score = 100 if total_ssids else 0
    return success({
        "health_score": health_score,
        "status": "healthy" if health_score >= 80 else "critical",
        "validation": validation.get("validation"),
        "timestamp": datetime.now().isoformat(),
        "total_ssids": total_ssids,
        "total_users": validation.get("total_users", 0),
    })


def build_ssid_stats(client):
    users = metric_value_map(client.query(wireless_query("sfSsidUsrNum")), "SsidIndex")
    names = metric_label_map(client.query(wireless_query("sfSsidName")), "SsidIndex", "sfSsidName", decode=hex_to_string)
    stats = []
    for index in set(users) | set(names):
        stats.append({
            "name": names.get(index, f"SSID-{index}"),
            "users": int(users.get(index, 0)),
        })
    return sorted(stats, key=lambda item: item["users"], reverse=True)


def wireless_query(metric_name):
    config = current_app.config
    labels = {
        "auth": config["WIRELESS_AUTH"],
        "instance": config["WIRELESS_INSTANCE"],
        "job": config["WIRELESS_JOB"],
        "module": config["WIRELESS_MODULE"],
    }
    label_text = ",".join(f'{key}="{escape_label_value(value)}"' for key, value in labels.items())
    return f"{metric_name}{{{label_text}}}"


def escape_label_value(value):
    return str(value).replace("\\", "\\\\").replace('"', '\\"')


def metric_value_map(results, index_label):
    values = {}
    for result in results:
        index = result.get("metric", {}).get(index_label)
        if index is not None:
            values[index] = metric_value([result], 0)
    return values


def metric_label_map(results, index_label, value_label, decode=None):
    values = {}
    for result in results:
        metric = result.get("metric", {})
        index = metric.get(index_label)
        raw_value = metric.get(value_label)
        if index is not None and raw_value is not None:
            values[index] = decode(raw_value) if decode else raw_value
    return values


def build_ap_list(client):
    names = metric_label_map(client.query(wireless_query("sfApName")), "apIndex", "sfApName", decode=hex_to_string)
    statuses = metric_label_map(client.query(wireless_query("sfApStatus")), "apIndex", "sfApStatus", decode=hex_to_string)
    user_counts = metric_value_map(client.query(wireless_query("sfApUsrNum")), "apIndex")
    ips = metric_label_map(client.query(wireless_query("sfApIP")), "apIndex", "sfApIP")
    macs = metric_label_map(client.query(wireless_query("sfApMAC")), "apIndex", "sfApMAC", decode=hex_to_mac)
    recv_rates = metric_label_map(client.query(wireless_query("sfApRecvRate")), "apIndex", "sfApRecvRate", decode=hex_to_string)
    send_rates = metric_label_map(client.query(wireless_query("sfApSendRate")), "apIndex", "sfApSendRate", decode=hex_to_string)

    ap_list = []
    indices = set(names) | set(statuses) | set(user_counts) | set(ips) | set(macs) | set(recv_rates) | set(send_rates)
    for index in sorted(indices, key=lambda value: int(value) if str(value).isdigit() else 999999):
        status = statuses.get(index, "Unknown")
        is_online = status == "Online"
        ap_list.append({
            "ap_index": index,
            "ap_name": names.get(index, f"AP-{index}"),
            "status": status,
            "status_text": "在线" if is_online else "离线",
            "status_class": "success" if is_online else "danger",
            "is_online": is_online,
            "user_count": int(user_counts.get(index, 0)),
            "ap_ip": ips.get(index, "N/A"),
            "ap_mac_address": macs.get(index, "N/A"),
            "ap_recv_rate": recv_rates.get(index, "0.00 bps"),
            "ap_send_rate": send_rates.get(index, "0.00 bps"),
        })
    return ap_list


def filter_aps(ap_list, search="", status=""):
    filtered = []
    for ap in ap_list:
        if status == "online" and not ap.get("is_online"):
            continue
        if status == "offline" and ap.get("is_online"):
            continue
        if search and not ap_matches(ap, search):
            continue
        filtered.append(ap)
    return filtered


def ap_matches(ap, keyword):
    fields = [
        ap.get("ap_name"),
        ap.get("ap_ip"),
        ap.get("ap_mac_address"),
        ap.get("status_text"),
        ap.get("status"),
        ap.get("ap_index"),
    ]
    return any(keyword in str(value).lower() for value in fields if value)


def ap_status_counts(ap_list):
    online = sum(1 for ap in ap_list if ap.get("is_online"))
    total = len(ap_list)
    return {
        "all": total,
        "online": online,
        "offline": total - online,
    }


def normalize_ap_status(value):
    status = (value or "").strip().lower()
    if status in {"online", "1", "true", "up"}:
        return "online"
    if status in {"offline", "0", "false", "down"}:
        return "offline"
    return ""


def normalize_ap_sort(value):
    sort_by = (value or "").strip().lower()
    return sort_by if sort_by in {"ap_recv_rate", "ap_send_rate"} else ""


def sort_aps(ap_list, sort_by="", sort_order="desc"):
    if not sort_by:
        return ap_list
    return sorted(ap_list, key=lambda ap: wireless_rate_sort_key(ap.get(sort_by), sort_order))


def empty_ap_payload(configured):
    return {
        "ap_list": [],
        "total_aps": 0,
        "all_total_aps": 0,
        "online_aps": 0,
        "offline_aps": 0,
        "total_users": 0,
        "returned": 0,
        "page": 1,
        "per_page": 10,
        "pages": 0,
        "q": "",
        "status": "",
        "sort_by": "",
        "sort_order": "desc",
        "status_counts": {"all": 0, "online": 0, "offline": 0},
        "configured": configured,
    }


def get_wireless_online_users():
    import time

    now = time.time()
    if wireless_user_cache["data"] and now - wireless_user_cache["last_update"] < wireless_user_cache["cache_ttl"]:
        enrich_wireless_real_names(wireless_user_cache["data"])
        wireless_user_cache["data"] = filter_meaningful_wireless_users(wireless_user_cache["data"])
        return wireless_user_cache["data"], True, True

    client = PrometheusClient()
    if not client.query_configured:
        return [], False, False

    ips = metric_label_map(client.query(wireless_query("sfStaIp")), "UserIndex", "sfStaIp", decode=hex_to_ip)
    recv_rates = metric_label_map(client.query(wireless_query("sfStaRecvRate")), "UserIndex", "sfStaRecvRate", decode=hex_to_string)
    send_rates = metric_label_map(client.query(wireless_query("sfStaSendRate")), "UserIndex", "sfStaSendRate", decode=hex_to_string)
    names = metric_label_map(client.query(wireless_query("sfUserName")), "UserIndex", "sfUserName", decode=hex_to_string)
    real_names = cached_real_name_map(names.values())

    users = []
    indices = set(ips) | set(recv_rates) | set(send_rates) | set(names)
    for index in sorted(indices, key=lambda value: int(value) if str(value).isdigit() else 999999):
        raw_user = names.get(index, "无")
        mobile_number = extract_mobile_number(raw_user)
        ip_address = ips.get(index, "N/A")
        users.append({
            "user_index": index,
            "phone_number": raw_user,
            "mobile_number": mobile_number or "",
            "real_name": real_names.get(mobile_number, "无") if mobile_number else "无",
            "ip_address": ip_address,
            "recv_rate": recv_rates.get(index, "N/A"),
            "send_rate": send_rates.get(index, "N/A"),
            "stable_id": wireless_user_stable_id(raw_user, ip_address, index),
        })

    users = filter_meaningful_wireless_users(users)
    wireless_user_cache["data"] = users
    wireless_user_cache["last_update"] = now
    return users, False, True


def filter_meaningful_wireless_users(users):
    return [user for user in users if is_meaningful_wireless_user(user)]


def is_meaningful_wireless_user(user):
    if extract_mobile_number(user.get("phone_number")):
        return True
    return is_valid_ip_address(user.get("ip_address"))


def is_valid_ip_address(value):
    text = str(value or "").strip()
    if text in {"", "N/A", "无", "-"}:
        return False
    parts = text.split(".")
    return len(parts) == 4 and all(part.isdigit() and 0 <= int(part) <= 255 for part in parts)


def enrich_wireless_real_names(users):
    real_names = cached_real_name_map(user.get("phone_number") for user in users)
    for user in users:
        mobile_number = extract_mobile_number(user.get("phone_number"))
        user["mobile_number"] = mobile_number or ""
        user["real_name"] = real_names.get(mobile_number, "无") if mobile_number else "无"
    return users


def resolve_wireless_real_names(users):
    dingtalk = DingTalkClient()
    for user in users:
        mobile_number = extract_mobile_number(user.get("phone_number"))
        user["mobile_number"] = mobile_number or ""
        if not mobile_number:
            user["real_name"] = "无"
            continue
        try:
            user["real_name"] = dingtalk.get_name_by_mobile(mobile_number) or "无"
        except Exception:
            user["real_name"] = "无"
    return users


def cached_real_name_map(values):
    mobiles = sorted({mobile for value in values if (mobile := extract_mobile_number(value))})
    if not mobiles:
        return {}
    rows = UserNameCache.query.filter(
        UserNameCache.mobile.in_(mobiles),
        UserNameCache.expires_at >= now_local(),
    ).all()
    return {row.mobile: row.real_name for row in rows}


def is_mobile_number(value):
    return bool(re.fullmatch(r"1\d{10}", str(value or "").strip()))


def extract_mobile_number(value):
    match = re.search(r"(?<!\d)1\d{10}(?!\d)", str(value or ""))
    return match.group(0) if match else None


def wireless_user_stable_id(raw_user, ip_address, index):
    user_value = normalize_stable_part(raw_user)
    ip_value = normalize_stable_part(ip_address)
    parts = [part for part in (user_value, ip_value) if part]
    if parts:
        return "user_" + hashlib.sha1("|".join(parts).encode("utf-8")).hexdigest()[:16]
    return f"temp_index_{index}"


def normalize_stable_part(value):
    text = str(value or "").strip()
    if not text or text in {"N/A", "无", "未知用户", "-"}:
        return ""
    return text


def filter_wireless_users(users, search=""):
    filtered = []
    for user in users:
        if search and not wireless_user_matches(user, search):
            continue
        filtered.append(user)
    return filtered


def wireless_user_matches(user, keyword):
    fields = [
        user.get("phone_number"),
        user.get("mobile_number"),
        user.get("real_name"),
        user.get("ip_address"),
        user.get("recv_rate"),
        user.get("send_rate"),
        user.get("user_index"),
    ]
    return any(keyword in str(value).lower() for value in fields if value)


def normalize_wireless_user_sort(value):
    sort_by = (value or "").strip().lower()
    return sort_by if sort_by in {"recv_rate", "send_rate"} else ""


def normalize_sort_order(value):
    sort_order = (value or "desc").strip().lower()
    return "asc" if sort_order == "asc" else "desc"


def sort_wireless_users(users, sort_by="", sort_order="desc"):
    if not sort_by:
        return users
    return sorted(users, key=lambda user: wireless_rate_sort_key(user.get(sort_by), sort_order))


def wireless_rate_sort_key(value, sort_order="desc"):
    bps = wireless_rate_bps(value)
    if bps < 0:
        return (1, 0)
    return (0, bps if sort_order == "asc" else -bps)


def wireless_rate_bps(value):
    text = str(value or "").strip()
    match = re.fullmatch(r"([0-9]+(?:\.[0-9]+)?)\s*([kmgt]?bps)", text, re.IGNORECASE)
    if not match:
        return -1
    number = float(match.group(1))
    unit = match.group(2).lower()
    multipliers = {
        "bps": 1,
        "kbps": 1000,
        "mbps": 1000 ** 2,
        "gbps": 1000 ** 3,
        "tbps": 1000 ** 4,
    }
    return number * multipliers.get(unit, 1)


def wireless_user_ssids(users):
    return []


def empty_wireless_user_payload(configured):
    return {
        "user_list": [],
        "total_users": 0,
        "returned": 0,
        "page": 1,
        "per_page": 10,
        "pages": 0,
        "q": "",
        "sort_by": "",
        "sort_order": "desc",
        "ssid": "",
        "ssids": [],
        "all_total_users": 0,
        "cached": False,
        "names_resolved": False,
        "configured": configured,
    }


def int_arg(name, default, minimum, maximum):
    value = request.args.get(name)
    try:
        parsed = int(value) if value is not None else default
    except (TypeError, ValueError):
        parsed = default
    return max(minimum, min(maximum, parsed))


def empty_wireless_data():
    return {
        "wireless_users": 0,
        "cpu_usage": 0,
        "memory_usage": 0,
        "ap_online": 0,
        "ssid_stats": [],
        "configured": False,
    }
