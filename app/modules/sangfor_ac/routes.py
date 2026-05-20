from flask import Blueprint, current_app, jsonify, request
from flask_login import login_required

from app.common.responses import failure, success
from app.modules.auth.decorators import require_admin
from app.modules.access_control.name_cache import (
    extract_mobile,
    schedule_client_name_cache_refresh,
    valid_name_cache_map,
)
from app.modules.sangfor_ac.client import SangforACClient


sangfor_ac_bp = Blueprint("sangfor_ac_api", __name__, url_prefix="/api/sangfor")
legacy_status_bp = Blueprint("legacy_status_api", __name__)


@sangfor_ac_bp.route("/status/version", methods=["GET"])
@login_required
def version():
    result = SangforACClient().get_version()
    return success(result)


@sangfor_ac_bp.route("/user-rank", methods=["GET"])
@login_required
def user_rank():
    page = int_arg("page", 1, 1, 10000)
    per_page = int_arg("per_page", 10, 10, 500)
    top = int_arg("top", current_app.config.get("SANGFOR_AC_USER_RANK_TOP", 10000), 1, 50000)
    line = (request.args.get("line") or "0").strip() or "0"
    keyword = (request.args.get("q") or "").strip().lower()

    client = SangforACClient()
    result = client.get_user_rank(top=top, line=line)
    if result.get("code") != 0:
        return success(empty_user_rank_payload(page, per_page, line, top), message=result.get("message", "获取用户流量排行失败"), code=1)

    raw_rows = result.get("data") or []
    mobiles = extract_user_rank_mobiles(raw_rows)
    cached_names = valid_name_cache_map(mobiles)
    name_cache_refresh = schedule_client_name_cache_refresh(mobiles)
    rows = [normalize_user_rank_row(row, index + 1, cached_names) for index, row in enumerate(raw_rows)]
    if keyword:
        rows = [row for row in rows if user_rank_row_matches(row, keyword)]

    rows.sort(key=lambda item: item["total_bytes"], reverse=True)
    for index, row in enumerate(rows, start=1):
        row["rank"] = index

    total = len(rows)
    start = (page - 1) * per_page
    page_rows = rows[start:start + per_page]
    return success({
        "items": page_rows,
        "summary": user_rank_summary(rows),
        "total": total,
        "all_total": len(raw_rows),
        "page": page,
        "per_page": per_page,
        "pages": (total + per_page - 1) // per_page if total else 0,
        "returned": len(page_rows),
        "line": line,
        "top": top,
        "source": ac_source(client),
        "name_cache_refresh": name_cache_refresh,
    })


@legacy_status_bp.route("/api/status/online-user", methods=["GET"])
@login_required
def legacy_online_user():
    return jsonify(SangforACClient().get_online_users())


@legacy_status_bp.route("/api/status/online-user-list", methods=["GET"])
@login_required
def legacy_online_user_list():
    return jsonify(SangforACClient().get_user_rank(top=1000, line="0"))


@legacy_status_bp.route("/api/status/session-num", methods=["GET"])
@login_required
def legacy_session_num():
    return jsonify(SangforACClient().get_session_num())


@legacy_status_bp.route("/api/status/cpu-usage", methods=["GET"])
@login_required
def legacy_cpu_usage():
    return jsonify(SangforACClient().get_cpu_usage())


@legacy_status_bp.route("/api/status/memory-usage", methods=["GET"])
@login_required
def legacy_memory_usage():
    return jsonify(SangforACClient().get_memory_usage())


@legacy_status_bp.route("/api/status/disk-usage", methods=["GET"])
@login_required
def legacy_disk_usage():
    return jsonify(SangforACClient().get_disk_usage())


@legacy_status_bp.route("/api/status/system-time", methods=["GET"])
@login_required
def legacy_system_time():
    return jsonify(SangforACClient().get_system_time())


@legacy_status_bp.route("/api/status/throughput", methods=["POST"])
@login_required
def legacy_throughput():
    data = request.get_json(silent=True) or {}
    return jsonify(SangforACClient().get_throughput(
        unit=data.get("unit", "bytes"),
        interface=data.get("interface"),
    ))


@legacy_status_bp.route("/api/status/user-rank", methods=["POST"])
@login_required
def legacy_user_rank():
    data = request.get_json(silent=True) or {}
    filter_data = data.get("filter", {})
    return jsonify(SangforACClient().get_user_rank(
        top=filter_data.get("top", 1000),
        line=filter_data.get("line", "0"),
        groups=filter_data.get("groups"),
        users=filter_data.get("users"),
        ips=filter_data.get("ips"),
    ))


@legacy_status_bp.route("/api/status/app-rank", methods=["POST"])
@login_required
def legacy_app_rank():
    data = request.get_json(silent=True) or {}
    filter_data = data.get("filter", {})
    return jsonify(SangforACClient().get_app_rank(
        top=filter_data.get("top", 60),
        groups=filter_data.get("groups"),
        line=filter_data.get("line", "0"),
    ))


@legacy_status_bp.route("/api/policy/netpolicy", methods=["GET"])
@login_required
def legacy_netpolicy():
    return jsonify(SangforACClient().get_netpolicies())


@legacy_status_bp.route("/api/user/kick-offline", methods=["POST"])
@login_required
@require_admin
def legacy_kick_user_offline():
    return failure("强制用户下线功能暂不支持，请使用设备管理界面操作", status=501)


@legacy_status_bp.route("/api/statistics/behavior", methods=["GET"])
@login_required
def legacy_behavior():
    return success(None, message="Success")


@legacy_status_bp.route("/api/prometheus/metrics", methods=["GET"])
@login_required
def legacy_prometheus_metrics():
    return failure("此接口已禁用，请使用其他 API 获取数据", code=404, status=404)


def int_arg(name, default, minimum, maximum):
    value = request.args.get(name)
    try:
        parsed = int(value) if value not in {None, ""} else int(default)
    except (TypeError, ValueError):
        parsed = int(default)
    return max(minimum, min(maximum, parsed))


def empty_user_rank_payload(page, per_page, line, top):
    client = SangforACClient()
    return {
        "items": [],
        "summary": {
            "user_count": 0,
            "normal_count": 0,
            "frozen_count": 0,
            "session_count": 0,
            "up_rate": "0 bps",
            "down_rate": "0 bps",
            "total_rate": "0 bps",
        },
        "total": 0,
        "all_total": 0,
        "page": page,
        "per_page": per_page,
        "pages": 0,
        "returned": 0,
        "line": line,
        "top": top,
        "source": ac_source(client),
        "name_cache_refresh": {
            "configured": False,
            "running": False,
            "queued": 0,
            "missing": 0,
            "last_started_at": None,
            "last_finished_at": None,
            "last_batch_size": 0,
            "last_success_count": 0,
            "last_error": None,
        },
    }


def ac_source(client):
    return client.base_url if client.host else ""


def extract_user_rank_mobiles(rows):
    mobiles = []
    seen = set()
    for row in rows:
        mobile = extract_mobile((row or {}).get("name"))
        if mobile and mobile not in seen:
            seen.add(mobile)
            mobiles.append(mobile)
    return mobiles


def normalize_user_rank_row(row, rank, cached_names=None):
    cached_names = cached_names or {}
    apps = normalize_user_rank_apps(((row or {}).get("detail") or {}).get("data") or [])
    user_name = string_value((row or {}).get("name"))
    mobile = extract_mobile(user_name)
    up_bytes = number_value((row or {}).get("up"))
    down_bytes = number_value((row or {}).get("down"))
    total_bytes = number_value((row or {}).get("total"))
    if not total_bytes:
        total_bytes = up_bytes + down_bytes
    return {
        "id": (row or {}).get("id"),
        "rank": rank,
        "name": user_name,
        "real_name": cached_names.get(mobile, "") if mobile else "",
        "name_is_mobile": bool(mobile),
        "group": string_value((row or {}).get("group")),
        "ip": string_value((row or {}).get("ip")),
        "up_bytes": up_bytes,
        "down_bytes": down_bytes,
        "total_bytes": total_bytes,
        "up_rate": format_byte_rate(up_bytes),
        "down_rate": format_byte_rate(down_bytes),
        "total_rate": format_byte_rate(total_bytes),
        "session": int(number_value((row or {}).get("session"))),
        "status": bool((row or {}).get("status")),
        "apps": apps,
    }


def normalize_user_rank_apps(rows):
    apps = []
    for item in rows:
        total_bytes = number_value(item.get("total") if isinstance(item, dict) else 0)
        apps.append({
            "app": string_value(item.get("app")) if isinstance(item, dict) else "",
            "line": item.get("line") if isinstance(item, dict) else None,
            "percent": number_value(item.get("percent")) if isinstance(item, dict) else 0,
            "up_rate": format_byte_rate(item.get("up") if isinstance(item, dict) else 0),
            "down_rate": format_byte_rate(item.get("down") if isinstance(item, dict) else 0),
            "total_rate": format_byte_rate(total_bytes),
            "total_bytes": total_bytes,
        })
    apps.sort(key=lambda item: item["total_bytes"], reverse=True)
    return apps[:3]


def user_rank_row_matches(row, keyword):
    fields = [
        row.get("name"),
        row.get("real_name"),
        row.get("ip"),
        row.get("up_rate"),
        row.get("down_rate"),
    ]
    fields.extend(app.get("app") for app in row.get("apps", []))
    return any(keyword in str(value).lower() for value in fields if value)


def user_rank_summary(rows):
    up_bytes = sum(row["up_bytes"] for row in rows)
    down_bytes = sum(row["down_bytes"] for row in rows)
    total_bytes = sum(row["total_bytes"] for row in rows)
    return {
        "user_count": len(rows),
        "normal_count": sum(1 for row in rows if row["status"]),
        "frozen_count": sum(1 for row in rows if not row["status"]),
        "session_count": sum(row["session"] for row in rows),
        "up_rate": format_byte_rate(up_bytes),
        "down_rate": format_byte_rate(down_bytes),
        "total_rate": format_byte_rate(total_bytes),
    }


def number_value(value):
    try:
        number = float(value)
    except (TypeError, ValueError):
        return 0
    return max(0, number)


def string_value(value):
    text = str(value or "").strip()
    return text or "-"


def format_byte_rate(value):
    bps = number_value(value) * 8
    if bps >= 1_000_000_000:
        return f"{bps / 1_000_000_000:.2f} Gbps"
    if bps >= 1_000_000:
        return f"{bps / 1_000_000:.2f} Mbps"
    if bps >= 1_000:
        return f"{bps / 1_000:.0f} Kbps"
    return f"{bps:.0f} bps"
