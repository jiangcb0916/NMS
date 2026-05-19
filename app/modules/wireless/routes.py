from datetime import datetime

from flask import Blueprint, current_app
from flask_login import login_required

from app.common.responses import success
from app.modules.integrations.prometheus import (
    PrometheusClient,
    hex_to_ip,
    hex_to_mac,
    hex_to_string,
    metric_value,
    parse_user_names_metrics,
)


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

    query = wireless_query
    users = metric_value(client.query(query("sfUserNum")), 0)
    cpu = metric_value(client.query(query("sfSysCpuCostRate")), 0)
    ap_online = metric_value(client.query(query("sfApOnlineNum")), 0)
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
        return success({
            "ap_list": [],
            "total_aps": 0,
            "online_aps": 0,
            "total_users": 0,
            "configured": False,
        }, message="Prometheus 查询接口未配置", code=1)

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
        ap_list.append({
            "ap_index": index,
            "ap_name": names.get(index, f"AP-{index}"),
            "status": status,
            "status_text": "在线" if status == "Online" else "离线",
            "status_class": "success" if status == "Online" else "danger",
            "user_count": int(user_counts.get(index, 0)),
            "ap_ip": ips.get(index, "N/A"),
            "ap_mac_address": macs.get(index, "N/A"),
            "ap_recv_rate": recv_rates.get(index, "0.00 bps"),
            "ap_send_rate": send_rates.get(index, "0.00 bps"),
        })

    return success({
        "ap_list": ap_list,
        "total_aps": len(ap_list),
        "online_aps": sum(1 for ap in ap_list if ap["status"] == "Online"),
        "total_users": sum(ap["user_count"] for ap in ap_list),
        "configured": True,
    })


@wireless_bp.route("/api/statistics/online-user-list", methods=["GET"])
@login_required
def wireless_online_users():
    import time

    now = time.time()
    if wireless_user_cache["data"] and now - wireless_user_cache["last_update"] < wireless_user_cache["cache_ttl"]:
        return success({
            "user_list": wireless_user_cache["data"],
            "total_users": len(wireless_user_cache["data"]),
            "cached": True,
        })

    client = PrometheusClient()
    if not client.query_configured:
        return success({
            "user_list": [],
            "total_users": 0,
            "cached": False,
            "configured": False,
        }, message="Prometheus 查询接口未配置", code=1)

    ips = metric_label_map(client.query(wireless_query("sfStaIp")), "UserIndex", "sfStaIp", decode=hex_to_ip)
    macs = metric_label_map(client.query(wireless_query("sfStaMacAddress")), "UserIndex", "sfStaMacAddress", decode=hex_to_mac)
    recv_rates = metric_label_map(client.query(wireless_query("sfStaRecvRate")), "UserIndex", "sfStaRecvRate", decode=hex_to_string)
    send_rates = metric_label_map(client.query(wireless_query("sfStaSendRate")), "UserIndex", "sfStaSendRate", decode=hex_to_string)
    ssids = metric_label_map(client.query(wireless_query("sfStaSsid")), "UserIndex", "sfStaSsid", decode=hex_to_string)
    names = metric_label_map(client.query(wireless_query("sfUserName")), "UserIndex", "sfUserName", decode=hex_to_string)

    users = []
    indices = set(ips) | set(macs) | set(recv_rates) | set(send_rates) | set(ssids) | set(names)
    for index in sorted(indices, key=lambda value: int(value) if str(value).isdigit() else 999999):
        ip_address = ips.get(index, "N/A")
        stable_id = f"ip_{ip_address}" if ip_address != "N/A" else f"index_{index}"
        users.append({
            "user_index": index,
            "phone_number": names.get(index, "未知用户"),
            "ip_address": ip_address,
            "mac_address": macs.get(index, "N/A"),
            "ssid": ssids.get(index, "N/A"),
            "recv_rate": recv_rates.get(index, "N/A"),
            "send_rate": send_rates.get(index, "N/A"),
            "stable_id": stable_id,
        })

    wireless_user_cache["data"] = users
    wireless_user_cache["last_update"] = now
    return success({
        "user_list": users,
        "total_users": len(users),
        "cached": False,
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
    response, _ = wireless_online_users()
    data = response.get_json()["data"]
    users = data.get("user_list", [])
    missing_ip = sum(1 for user in users if user.get("ip_address") == "N/A")
    missing_mac = sum(1 for user in users if user.get("mac_address") == "N/A")
    return success({
        "validation": {
            "timestamp": datetime.now().isoformat(),
            "status": "success",
            "issues": [],
            "warnings": [],
            "data_quality": "good" if not missing_ip and not missing_mac else "fair",
            "statistics": {
                "total_users": len(users),
                "empty_ips": missing_ip,
                "empty_macs": missing_mac,
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


def wireless_query(metric_name):
    config = current_app.config
    labels = {
        "auth": config["WIRELESS_AUTH"],
        "instance": config["WIRELESS_INSTANCE"],
        "job": config["WIRELESS_JOB"],
        "module": config["WIRELESS_MODULE"],
    }
    label_text = ",".join(f'{key}="{value}"' for key, value in labels.items())
    return f"{metric_name}{{{label_text}}}"


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


def empty_wireless_data():
    return {
        "wireless_users": 0,
        "cpu_usage": 0,
        "memory_usage": 0,
        "ap_online": 0,
        "ssid_stats": [],
        "configured": False,
    }
