from flask import Blueprint, current_app
from flask_login import login_required

from app.common.responses import success
from app.extensions import db
from app.models.cache import DeviceOsCache, UserNameCache
from app.models.device import Device
from app.models.user import User
from app.modules.firewall import routes as firewall_routes
from app.modules.firewall.routes import default_payload as default_firewall_payload
from app.modules.firewall.routes import fetch_huawei_firewall_status
from app.modules.integrations.access_control import AccessControlClient
from app.modules.osdwan import routes as osdwan_routes
from app.modules.sangfor_ac import routes as sangfor_ac_routes
from app.modules.switches import routes as switch_routes
from app.modules.wireless import routes as wireless_routes


dashboard_bp = Blueprint("dashboard_api", __name__)
TOP_LIMIT = 5


@dashboard_bp.route("/api/health", methods=["GET"])
def health():
    return success({
        "status": "ok",
        "version": current_app.config["VERSION"],
        "database": "configured" if db.engine else "unavailable",
    })


@dashboard_bp.route("/api/dashboard/summary", methods=["GET"])
@login_required
def summary():
    return success(summary_payload())


@dashboard_bp.route("/api/dashboard/overview", methods=["GET"])
@login_required
def overview():
    summary_data = summary_payload()
    wireless_data = dashboard_wireless_payload()
    return success({
        "summary": summary_data,
        "access_clients": dashboard_access_clients_payload(),
        "switches": dashboard_switches_payload(),
        "wireless": wireless_data,
        "firewall": dashboard_firewall_payload(),
        "osdwan": dashboard_osdwan_payload(),
        "traffic_apps": dashboard_traffic_apps_payload(),
        "tops": {
            "wireless_users": wireless_data["user_tops"],
            "aps": wireless_data["ap_tops"],
        },
    })


def summary_payload():
    return {
        "users": {
            "total": User.query.count(),
            "active": User.query.filter_by(is_active=True).count(),
        },
        "devices": {
            "total": Device.query.count(),
            "online": Device.query.filter_by(is_online=True).count(),
        },
        "cache": {
            "user_names": UserNameCache.query.count(),
            "device_os": DeviceOsCache.query.count(),
        },
    }


def dashboard_access_clients_payload():
    client = AccessControlClient()
    if not client.configured:
        return {"total": 0, "configured": False, "ok": False, "error": "联软准入 API 未配置"}

    try:
        client.timeout = 5
        payload = client.query_devices(terminaltype="1")
        if payload.get("status") != "SUCCESS":
            return {
                "total": 0,
                "configured": True,
                "ok": False,
                "error": payload.get("msg", "联软准入 API 调用失败"),
            }

        filter_department = current_app.config.get("ACCESS_CONTROL_FILTER_DEPARTMENT")
        rows = payload.get("rows", [])
        if filter_department:
            rows = [row for row in rows if row.get("strdeptname") == filter_department]
        return {"total": len(rows), "configured": True, "ok": True, "error": ""}
    except Exception as exc:
        current_app.logger.warning("Dashboard 准入客户端统计读取失败: %s", exc)
        return {"total": 0, "configured": True, "ok": False, "error": str(exc)}


def dashboard_firewall_payload():
    try:
        payload = fetch_huawei_firewall_status(timeout=5)
        hydrate_dashboard_firewall_rates(payload)
        payload["ok"] = bool(payload.get("configured"))
        payload["error"] = ""
        return payload
    except Exception as exc:
        current_app.logger.warning("Dashboard 华为防火墙指标读取失败: %s", exc)
        payload = default_firewall_payload(configured=bool(
            current_app.config.get("HUAWEI_SNMP_URL") and current_app.config.get("HUAWEI_FIREWALL_TARGET")
        ))
        payload["ok"] = False
        payload["error"] = str(exc)
        return payload


def hydrate_dashboard_firewall_rates(payload):
    if not payload.get("configured"):
        return payload

    payload["sample_count"] = len(firewall_routes.bandwidth_samples)
    if payload.get("total_upload") or payload.get("total_download"):
        return payload

    try:
        samples = firewall_routes.query_prometheus_bandwidth_range("5m", 5 * 60)
    except Exception as exc:
        current_app.logger.warning("Dashboard 防火墙 Prometheus 速率补齐失败: %s", exc.__class__.__name__)
        return payload
    if not samples:
        return payload

    latest = samples[-1]
    for key in [
        "telecom_upload",
        "telecom_download",
        "unicom_upload",
        "unicom_download",
        "total_upload",
        "total_download",
        "upload_utilization",
        "download_utilization",
    ]:
        payload[key] = latest.get(key, payload.get(key, 0))
    payload["rate_source"] = "prometheus"
    return payload


def dashboard_switches_payload():
    if not switch_routes.PrometheusClient().targets_configured:
        return {"total": 0, "online": 0, "offline": 0, "configured": False, "ok": False, "error": "Prometheus targets 接口未配置"}

    try:
        client = switch_routes.PrometheusClient()
        client.timeout = 5
        switches = switch_routes.build_switch_targets(client)
        online = sum(1 for item in switches if item.get("is_online"))
        return {
            "total": len(switches),
            "online": online,
            "offline": len(switches) - online,
            "avg_scrape_duration": switch_routes.avg_scrape_duration(switches),
            "configured": True,
            "ok": True,
            "error": "",
        }
    except Exception as exc:
        current_app.logger.warning("Dashboard 交换机指标读取失败: %s", exc.__class__.__name__)
        return {"total": 0, "online": 0, "offline": 0, "configured": True, "ok": False, "error": str(exc)}


def dashboard_osdwan_payload():
    client = osdwan_routes.WanFlowClient()
    if not client.configured:
        return empty_osdwan_dashboard(configured=False, error="OSDWAN Token 未配置")

    try:
        client.timeout = 5
        payload, message, code = osdwan_routes.build_metrics_payload(client)
        proxy_status = payload.get("proxy_status") or osdwan_routes.empty_proxy_status()
        errors = payload.get("errors") or {}
        all_stats = payload.get("all_stats") or {}
        node = payload.get("node") or {}
        node_stats = node.get("stats") or {}
        return {
            "configured": True,
            "ok": code == 0 and not errors,
            "error": "" if code == 0 else message,
            "errors": errors,
            "user_count": payload.get("overall_user_count", 0),
            "user_capacity": payload.get("user_capacity", current_app.config.get("OSDWAN_USER_CAPACITY", 30)),
            "proxy_status": proxy_status,
            "bandwidth_latest": all_stats.get("latest") or {},
            "saas_latest": node_stats.get("latest") or {},
            "node_name": (node.get("name") or current_app.config.get("OSDWAN_NODE_NAME", "办公开发")),
            "queried_at": payload.get("queried_at") or "",
        }
    except Exception as exc:
        current_app.logger.warning("Dashboard OSDWAN 指标读取失败: %s", exc.__class__.__name__)
        return empty_osdwan_dashboard(configured=True, error=str(exc))


def empty_osdwan_dashboard(configured, error=""):
    return {
        "configured": configured,
        "ok": False,
        "error": error,
        "errors": {},
        "user_count": 0,
        "user_capacity": current_app.config.get("OSDWAN_USER_CAPACITY", 30),
        "proxy_status": osdwan_routes.empty_proxy_status(),
        "bandwidth_latest": {},
        "saas_latest": {},
        "node_name": current_app.config.get("OSDWAN_NODE_NAME", "办公开发"),
        "queried_at": "",
    }


def dashboard_traffic_apps_payload():
    client = sangfor_ac_routes.SangforACClient()
    if not client.configured:
        return empty_traffic_apps_dashboard(configured=False, error="深信服 AC 接口未配置")

    try:
        client.timeout = 5
        top = current_app.config.get("SANGFOR_AC_USER_RANK_TOP", 10000)
        result = sangfor_ac_routes.get_cached_user_rank(client, top, "0")
        if result.get("code") != 0:
            return empty_traffic_apps_dashboard(
                configured=True,
                error=result.get("message", "获取应用排行失败"),
                source=sangfor_ac_routes.ac_source(client),
            )

        rows = result.get("data") or []
        apps = aggregate_dashboard_apps(rows)
        return {
            "configured": True,
            "ok": True,
            "error": "",
            "source": sangfor_ac_routes.ac_source(client),
            "user_count": len(rows),
            "total_apps": len(apps),
            "items": apps[:5],
        }
    except Exception as exc:
        current_app.logger.warning("Dashboard 应用排行读取失败: %s", exc.__class__.__name__)
        return empty_traffic_apps_dashboard(configured=True, error=str(exc), source=sangfor_ac_routes.ac_source(client))


def empty_traffic_apps_dashboard(configured, error="", source=""):
    return {
        "configured": configured,
        "ok": False,
        "error": error,
        "source": source,
        "user_count": 0,
        "total_apps": 0,
        "items": [],
    }


def aggregate_dashboard_apps(rows):
    app_map = {}
    for row in rows:
        detail_rows = ((row or {}).get("detail") or {}).get("data") or []
        for item in detail_rows:
            if not isinstance(item, dict):
                continue
            name = sangfor_ac_routes.string_value(item.get("app"))
            stats = app_map.setdefault(name, {
                "app": name,
                "up_bytes": 0,
                "down_bytes": 0,
                "total_bytes": 0,
                "user_count": 0,
            })
            up_bytes = sangfor_ac_routes.number_value(item.get("up"))
            down_bytes = sangfor_ac_routes.number_value(item.get("down"))
            total_bytes = sangfor_ac_routes.number_value(item.get("total")) or (up_bytes + down_bytes)
            stats["up_bytes"] += up_bytes
            stats["down_bytes"] += down_bytes
            stats["total_bytes"] += total_bytes
            stats["user_count"] += 1

    apps = sorted(app_map.values(), key=lambda item: item["total_bytes"], reverse=True)
    total = sum(item["total_bytes"] for item in apps)
    for item in apps:
        item["up_rate"] = sangfor_ac_routes.format_byte_rate(item["up_bytes"])
        item["down_rate"] = sangfor_ac_routes.format_byte_rate(item["down_bytes"])
        item["total_rate"] = sangfor_ac_routes.format_byte_rate(item["total_bytes"])
        item["percent"] = round((item["total_bytes"] / total * 100), 1) if total else 0
    return apps


def dashboard_wireless_payload():
    if not wireless_routes.PrometheusClient().query_configured:
        return empty_wireless_dashboard(configured=False, error="Prometheus 查询接口未配置")

    try:
        client = wireless_routes.PrometheusClient()
        client.timeout = 5
        controller = {
            "wireless_users": int(wireless_routes.metric_value(client.query(wireless_routes.wireless_query("sfUserNum")), 0)),
            "cpu_usage": round(wireless_routes.metric_value(client.query(wireless_routes.wireless_query("sfSysCpuCostRate")), 0), 1),
            "ap_online": int(wireless_routes.metric_value(client.query(wireless_routes.wireless_query("sfApOnlineNum")), 0)),
        }
        users, cached, _ = wireless_routes.get_wireless_online_users()
        aps = wireless_routes.build_ap_list(client)
        return {
            **controller,
            "total_aps": len(aps),
            "cached": cached,
            "configured": True,
            "ok": True,
            "error": "",
            "user_tops": {
                "upload": wireless_user_top(users, "recv_rate"),
                "download": wireless_user_top(users, "send_rate"),
            },
            "ap_tops": {
                "upload": ap_top(aps, "ap_recv_rate"),
                "download": ap_top(aps, "ap_send_rate"),
            },
        }
    except Exception as exc:
        current_app.logger.warning("Dashboard 无线指标读取失败: %s", exc)
        return empty_wireless_dashboard(configured=True, error=str(exc))


def empty_wireless_dashboard(configured, error=""):
    return {
        "wireless_users": 0,
        "cpu_usage": 0,
        "ap_online": 0,
        "total_aps": 0,
        "cached": False,
        "configured": configured,
        "ok": False,
        "error": error,
        "user_tops": {"upload": [], "download": []},
        "ap_tops": {"upload": [], "download": []},
    }


def wireless_user_top(users, rate_key):
    sorted_users = sorted(
        users,
        key=lambda user: wireless_routes.wireless_rate_bps(user.get(rate_key)),
        reverse=True,
    )
    items = []
    for user in sorted_users:
        bps = wireless_routes.wireless_rate_bps(user.get(rate_key))
        if bps < 0:
            continue
        user_label = user.get("real_name") if user.get("real_name") not in {"", "无", None} else user.get("phone_number")
        items.append({
            "label": user_label or user.get("ip_address") or "未知用户",
            "sub_label": user.get("ip_address") or user.get("phone_number") or "",
            "value": user.get(rate_key) or "0 bps",
            "bps": bps,
        })
        if len(items) >= TOP_LIMIT:
            break
    return items


def ap_top(aps, rate_key):
    sorted_aps = sorted(
        aps,
        key=lambda ap: wireless_routes.wireless_rate_bps(ap.get(rate_key)),
        reverse=True,
    )
    items = []
    for ap in sorted_aps:
        bps = wireless_routes.wireless_rate_bps(ap.get(rate_key))
        if bps < 0:
            continue
        items.append({
            "label": ap.get("ap_name") or f"AP-{ap.get('ap_index')}",
            "sub_label": ap.get("ap_ip") or ap.get("ap_mac_address") or "",
            "value": ap.get(rate_key) or "0 bps",
            "bps": bps,
        })
        if len(items) >= TOP_LIMIT:
            break
    return items


@dashboard_bp.route("/api/status/version", methods=["GET"])
@login_required
def legacy_version():
    devices = [{
        "name": "网络管理系统",
        "type": "system",
        "version": current_app.config["VERSION"],
        "status": "ok",
    }]

    ac_host = current_app.config.get("SANGFOR_AC_HOST")
    if ac_host:
        devices.append({
            "name": f"深信服上网行为管理 ({ac_host})",
            "type": "sangfor_ac",
            "version": "待同步",
            "status": "configured",
        })
    else:
        devices.append({
            "name": "深信服上网行为管理",
            "type": "sangfor_ac",
            "version": "未配置",
            "status": "unconfigured",
        })

    return success(devices)
