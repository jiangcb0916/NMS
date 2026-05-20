from flask import Blueprint, current_app, request
from flask_login import login_required

from app.common.responses import success
from app.modules.cache.service import get_device_os_info
from app.modules.access_control.name_cache import (
    extract_client_mobiles,
    extract_mobile,
    schedule_client_name_cache_refresh,
    valid_name_cache_map,
)
from app.modules.integrations.access_control import AccessControlClient, normalize_client_row
from app.modules.integrations.dingtalk import DingTalkClient


access_control_bp = Blueprint("access_control_api", __name__, url_prefix="/api/access-control")


@access_control_bp.route("/client-list", methods=["GET"])
@login_required
def client_list():
    client = AccessControlClient()
    if not client.configured:
        return success(empty_client_payload(configured=False), message="联软准入 API 未配置", code=1)

    page = int_arg("page", default=1, minimum=1, maximum=10000)
    per_page = int_arg("per_page", default=10, minimum=10, maximum=500)
    search = (request.args.get("q") or "").strip().lower()
    status = normalize_client_status(request.args.get("status"))

    payload = client.query_devices(terminaltype="1")
    if payload.get("status") != "SUCCESS":
        return success(empty_client_payload(configured=True), message=payload.get("msg", "联软准入 API 调用失败"), code=1)

    rows = payload.get("rows", [])
    filter_department = current_app.config.get("ACCESS_CONTROL_FILTER_DEPARTMENT")
    department_rows = []
    for row in rows:
        if filter_department and row.get("strdeptname") != filter_department:
            continue
        department_rows.append(row)

    cached_names = valid_name_cache_map(extract_client_mobiles(department_rows)) if search else {}
    if search:
        cached_names = resolve_search_name_cache(department_rows, cached_names)
    filtered_rows = [
        row for row in department_rows
        if not search or row_matches(row, search, cached_real_name(row, cached_names))
    ]

    status_counts = client_status_counts(filtered_rows)
    all_filtered_mobiles = extract_client_mobiles(filtered_rows)
    name_cache_refresh = schedule_client_name_cache_refresh(all_filtered_mobiles)
    filtered_rows = filter_client_rows_by_status(filtered_rows, status)
    total = len(filtered_rows)
    start = (page - 1) * per_page
    page_rows = filtered_rows[start:start + per_page]
    page_cached_names = cached_names or valid_name_cache_map(extract_client_mobiles(page_rows))

    clients = []
    for row in page_rows:
        real_name = cached_real_name(row, page_cached_names)
        os_info = get_device_os_info(row.get("strdevip"), row)
        clients.append(normalize_client_row(row, real_name=real_name, os_info=os_info))

    return success({
        "client_list": clients,
        "total": total,
        "online_count": sum(1 for item in clients if item["is_online"]),
        "offline_count": sum(1 for item in clients if not item["is_online"]),
        "status": status,
        "status_counts": status_counts,
        "configured": True,
        "page": page,
        "per_page": per_page,
        "pages": (total + per_page - 1) // per_page if total else 0,
        "returned": len(clients),
        "name_cache_refresh": name_cache_refresh,
    })


@access_control_bp.route("/device-name", methods=["GET"])
@login_required
def device_name():
    device_ip = request.args.get("device_ip")
    if not device_ip:
        return success(None, message="缺少device_ip参数", code=1)
    row = first_device_row(device_ip)
    if not row:
        return success({"device_ip": device_ip, "device_name": None}, message=f"未找到IP为 {device_ip} 的设备", code=1)
    return success({
        "device_ip": device_ip,
        "device_name": row.get("strdevname", "N/A"),
        "mac_address": row.get("strmac", "N/A"),
        "username": row.get("strusername", "N/A"),
        "department": row.get("strdeptname", "N/A"),
        "is_online": row.get("status", 0) == 1,
    })


@access_control_bp.route("/device-ip-to-name", methods=["GET"])
@login_required
def device_ip_to_name():
    device_ip = request.args.get("device_ip")
    if not device_ip:
        return success(None, message="缺少device_ip参数", code=1)
    row = first_device_row(device_ip, only_online=True)
    if not row:
        return success({
            "device_ip": device_ip,
            "real_name": None,
            "username": None,
        }, message=f"未找到IP为 {device_ip} 的在线设备", code=1)

    mobile = row.get("strusername")
    real_name = DingTalkClient().get_name_by_mobile(mobile)
    return success({
        "device_ip": device_ip,
        "real_name": real_name,
        "username": mobile,
    })


def first_device_row(device_ip, only_online=False):
    client = AccessControlClient()
    if not client.configured:
        return None
    payload = client.query_devices(paramstype="2", paramsvalue=device_ip)
    if payload.get("status") != "SUCCESS":
        return None
    rows = payload.get("rows", [])
    if only_online:
        rows = [row for row in rows if row.get("status") == 1]
    return rows[0] if rows else None


def empty_client_payload(configured):
    return {
        "client_list": [],
        "total": 0,
        "online_count": 0,
        "offline_count": 0,
        "status": "",
        "status_counts": {"all": 0, "online": 0, "offline": 0},
        "configured": configured,
        "page": 1,
        "per_page": 10,
        "pages": 0,
        "returned": 0,
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


def int_arg(name, default, minimum, maximum):
    value = request.args.get(name)
    try:
        parsed = int(value) if value is not None else default
    except (TypeError, ValueError):
        parsed = default
    return max(minimum, min(maximum, parsed))


def cached_real_name(row, cached_names):
    mobile = extract_mobile(row.get("strusername"))
    return cached_names.get(mobile)


def resolve_search_name_cache(rows, cached_names):
    resolved_names = dict(cached_names)
    dingtalk = DingTalkClient()
    if not dingtalk.configured:
        return resolved_names

    limit = search_name_resolve_limit()
    if limit <= 0:
        return resolved_names

    resolved_count = 0
    for mobile in extract_client_mobiles(rows):
        if mobile in resolved_names:
            continue
        if resolved_count >= limit:
            break
        try:
            real_name = dingtalk.get_name_by_mobile(mobile)
        except Exception as exc:
            current_app.logger.warning("搜索客户端姓名解析失败: %s %s", mobile, exc.__class__.__name__)
            continue
        resolved_count += 1
        if real_name:
            resolved_names[mobile] = real_name
    return resolved_names


def search_name_resolve_limit():
    try:
        return int(current_app.config.get("CLIENT_NAME_SEARCH_RESOLVE_LIMIT", 500))
    except (TypeError, ValueError):
        return 500


def row_matches(row, keyword, real_name=None):
    fields = [
        row.get("strdevip"),
        row.get("strusername"),
        row.get("struserdes"),
        real_name,
        row.get("strdevname"),
        row.get("strmac"),
        row.get("strswitchname"),
        row.get("strlocation"),
        row.get("stros"),
        row.get("strosversion"),
        row.get("strversion"),
        row.get("strdevtype"),
    ]
    return any(keyword in str(value).lower() for value in fields if value)


def normalize_client_status(value):
    status = (value or "").strip().lower()
    if status in {"online", "1", "true", "up"}:
        return "online"
    if status in {"offline", "0", "false", "down"}:
        return "offline"
    return ""


def filter_client_rows_by_status(rows, status):
    if status == "online":
        return [row for row in rows if row.get("status") == 1]
    if status == "offline":
        return [row for row in rows if row.get("status") != 1]
    return rows


def client_status_counts(rows):
    online = sum(1 for row in rows if row.get("status") == 1)
    total = len(rows)
    return {
        "all": total,
        "online": online,
        "offline": total - online,
    }
