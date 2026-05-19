from flask import Blueprint, current_app, request
from flask_login import login_required

from app.common.responses import success
from app.modules.cache.service import get_device_os_info
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
    per_page = int_arg("per_page", default=100, minimum=10, maximum=500)
    search = (request.args.get("q") or "").strip().lower()
    resolve_names = (request.args.get("resolve_names") or "0").lower() in {"1", "true", "yes", "on"}

    payload = client.query_devices(terminaltype="1")
    if payload.get("status") != "SUCCESS":
        return success(empty_client_payload(configured=True), message=payload.get("msg", "联软准入 API 调用失败"), code=1)

    rows = payload.get("rows", [])
    filter_department = current_app.config.get("ACCESS_CONTROL_FILTER_DEPARTMENT")
    dingtalk = DingTalkClient()
    filtered_rows = []
    for row in rows:
        if filter_department and row.get("strdeptname") != filter_department:
            continue
        if search and not row_matches(row, search):
            continue
        filtered_rows.append(row)

    total = len(filtered_rows)
    start = (page - 1) * per_page
    page_rows = filtered_rows[start:start + per_page]

    clients = []
    for row in page_rows:
        mobile = row.get("strusername")
        real_name = dingtalk.get_name_by_mobile(mobile) if resolve_names else dingtalk.get_cached_name(mobile)
        os_info = get_device_os_info(row.get("strdevip"), row)
        clients.append(normalize_client_row(row, real_name=real_name, os_info=os_info))

    return success({
        "client_list": clients,
        "total": total,
        "online_count": sum(1 for item in clients if item["is_online"]),
        "offline_count": sum(1 for item in clients if not item["is_online"]),
        "configured": True,
        "page": page,
        "per_page": per_page,
        "pages": (total + per_page - 1) // per_page if total else 0,
        "returned": len(clients),
        "names_resolved": resolve_names,
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
        "configured": configured,
        "page": 1,
        "per_page": 100,
        "pages": 0,
        "returned": 0,
        "names_resolved": False,
    }


def int_arg(name, default, minimum, maximum):
    value = request.args.get(name)
    try:
        parsed = int(value) if value is not None else default
    except (TypeError, ValueError):
        parsed = default
    return max(minimum, min(maximum, parsed))


def row_matches(row, keyword):
    fields = [
        row.get("strdevip"),
        row.get("strusername"),
        row.get("strdevname"),
        row.get("strmac"),
        row.get("strdeptname"),
        row.get("strswitchname"),
        row.get("strlocation"),
        row.get("stros"),
        row.get("strdevtype"),
    ]
    return any(keyword in str(value).lower() for value in fields if value)
