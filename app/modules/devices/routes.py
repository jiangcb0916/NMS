import csv
import io

from flask import Blueprint, Response, current_app, request
from flask_login import login_required
from sqlalchemy import or_

from app.common.responses import created, failure, success
from app.common.validators import optional_string, required_string, validate_ip, validate_mac
from app.extensions import db
from app.models.base import now_local
from app.models.device import Device
from app.modules.auth.decorators import require_admin
from app.modules.devices.status import (
    monitoring_snapshot,
    refresh_all_device_status,
    start_status_monitoring,
    stop_status_monitoring,
    update_device_status,
)


device_bp = Blueprint("device_api", __name__, url_prefix="/api/access-control")


@device_bp.route("/device-list", methods=["GET"])
@login_required
def list_devices():
    page = int_arg("page", 1, min_value=1, max_value=100000)
    per_page = int_arg("per_page", 10, min_value=10, max_value=500)
    query = filtered_device_query()
    status_counts = device_status_counts(filtered_device_query(apply_status=False))
    total = query.count()
    pages = (total + per_page - 1) // per_page if total else 0
    if pages and page > pages:
        page = pages

    devices = (
        query.order_by(Device.created_at.desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
        .all()
    )
    return success({
        "devices": [device.to_dict() for device in devices],
        "total": total,
        "returned": len(devices),
        "page": page,
        "per_page": per_page,
        "pages": pages,
        "categories": device_categories(),
        "status": normalize_status(request.args.get("status")),
        "status_counts": status_counts,
    })


@device_bp.route("/device-statistics", methods=["GET"])
@login_required
def device_statistics():
    devices = Device.query.all()
    category_stats = {}
    online = 0

    for device in devices:
        category_stats[device.category] = category_stats.get(device.category, 0) + 1
        if device.is_online:
            online += 1

    return success({
        "category_stats": [
            {"name": category, "count": count}
            for category, count in sorted(category_stats.items())
        ],
        "status_stats": [
            {"name": "在线", "count": online},
            {"name": "离线", "count": len(devices) - online},
        ],
        "total_devices": len(devices),
    })


@device_bp.route("/device-list", methods=["POST"])
@login_required
@require_admin
def create_device():
    try:
        payload = parse_device_payload(request.get_json(silent=True) or {})
    except ValueError as exc:
        return failure(str(exc), status=400)

    if Device.query.filter_by(ip_address=payload["ip_address"]).first():
        return failure(f"IP地址 {payload['ip_address']} 已存在", status=400)

    device = Device(**payload)
    db.session.add(device)
    db.session.commit()
    return created(device.to_dict(), message="设备创建成功")


@device_bp.route("/device-list/export", methods=["GET"])
@login_required
def export_devices():
    output = io.StringIO()
    output.write("\ufeff")
    fieldnames = ["username", "ip_address", "mac_address", "category", "details", "is_online", "last_check_time"]
    writer = csv.DictWriter(output, fieldnames=fieldnames)
    writer.writeheader()

    for device in filtered_device_query().order_by(Device.created_at.desc()).all():
        data = device.to_dict()
        writer.writerow({field: data.get(field) or "" for field in fieldnames})

    response = Response(output.getvalue(), mimetype="text/csv; charset=utf-8")
    response.headers["Content-Disposition"] = "attachment; filename=devices.csv"
    return response


@device_bp.route("/device-list/import", methods=["POST"])
@login_required
@require_admin
def import_devices():
    upload = request.files.get("file")
    if not upload or not upload.filename:
        return failure("请选择要导入的CSV文件", status=400)

    raw_content = upload.read()
    if not raw_content:
        return failure("CSV文件为空", status=400)

    try:
        text_content = raw_content.decode("utf-8-sig")
    except UnicodeDecodeError:
        try:
            text_content = raw_content.decode("gbk")
        except UnicodeDecodeError:
            return failure("CSV文件编码不支持，请使用UTF-8或GBK", status=400)

    reader = csv.DictReader(io.StringIO(text_content))
    if not reader.fieldnames:
        return failure("CSV文件缺少表头", status=400)

    created_count = 0
    updated_count = 0
    skipped_count = 0
    errors = []

    for line_number, row in enumerate(reader, start=2):
        data = {
            "username": row_value(row, "username", "用户名", "设备名", "名称"),
            "ip_address": row_value(row, "ip_address", "IP", "IP地址", "ip", "地址"),
            "mac_address": row_value(row, "mac_address", "MAC", "MAC地址", "mac"),
            "category": row_value(row, "category", "分类", "类别"),
            "details": row_value(row, "details", "详情", "备注", "说明"),
        }

        if not data["username"] and not data["ip_address"]:
            skipped_count += 1
            continue

        try:
            payload = parse_device_payload(data)
        except ValueError as exc:
            skipped_count += 1
            errors.append({"line": line_number, "message": str(exc)})
            continue

        device = Device.query.filter_by(ip_address=payload["ip_address"]).first()
        if device:
            for key, value in payload.items():
                setattr(device, key, value)
            device.updated_at = now_local()
            updated_count += 1
        else:
            db.session.add(Device(**payload))
            created_count += 1

    db.session.commit()
    return success({
        "created": created_count,
        "updated": updated_count,
        "skipped": skipped_count,
        "error_count": len(errors),
        "errors": errors[:20],
        "categories": device_categories(),
    }, message=f"导入完成：新增 {created_count} 条，更新 {updated_count} 条，跳过 {skipped_count} 条")


@device_bp.route("/device-list/<int:device_id>", methods=["GET"])
@login_required
def get_device(device_id):
    device = Device.query.get(device_id)
    if not device:
        return failure("设备不存在", code=404, status=404)
    return success(device.to_dict())


@device_bp.route("/device-list/<int:device_id>", methods=["PUT"])
@login_required
@require_admin
def update_device(device_id):
    device = Device.query.get(device_id)
    if not device:
        return failure("设备不存在", code=404, status=404)

    try:
        payload = parse_device_payload(request.get_json(silent=True) or {})
    except ValueError as exc:
        return failure(str(exc), status=400)

    existing = Device.query.filter_by(ip_address=payload["ip_address"]).first()
    if existing and existing.id != device.id:
        return failure(f"IP地址 {payload['ip_address']} 已被其他设备使用", status=400)

    for key, value in payload.items():
        setattr(device, key, value)
    device.updated_at = now_local()
    db.session.commit()
    return success(device.to_dict(), message="设备更新成功")


@device_bp.route("/device-list/<int:device_id>", methods=["DELETE"])
@login_required
@require_admin
def delete_device(device_id):
    device = Device.query.get(device_id)
    if not device:
        return failure("设备不存在", code=404, status=404)

    db.session.delete(device)
    db.session.commit()
    return success({"changes": 1}, message="设备删除成功")


@device_bp.route("/ip-to-username", methods=["POST"])
@login_required
def ip_to_username():
    data = request.get_json(silent=True) or {}
    ip_addresses = data.get("ip_addresses")
    if not isinstance(ip_addresses, list):
        return failure("ip_addresses必须是数组", status=400)

    devices = Device.query.filter(Device.ip_address.in_(ip_addresses)).all() if ip_addresses else []
    mapping = {device.ip_address: device.username for device in devices}
    result = {ip: mapping.get(ip, ip) for ip in ip_addresses}

    return success({
        "ip_to_username_map": result,
        "total_ips": len(ip_addresses),
        "mapped_ips": sum(1 for ip in ip_addresses if ip in mapping),
    })


@device_bp.route("/device-status/<int:device_id>", methods=["POST"])
@login_required
def check_device_status(device_id):
    device = Device.query.get(device_id)
    if not device:
        return failure("设备不存在", code=404, status=404)

    is_online = update_device_status(device, timeout_seconds=current_app.config["DEVICE_STATUS_PING_TIMEOUT"])
    db.session.commit()
    return success({
        "device_id": device.id,
        "device_name": device.username,
        "ip_address": device.ip_address,
        "is_online": is_online,
        "last_check_time": device.to_dict()["last_check_time"],
    }, message="设备状态检查完成")


@device_bp.route("/device-status/refresh", methods=["POST"])
@login_required
@require_admin
def refresh_device_status():
    result = refresh_all_device_status(timeout_seconds=current_app.config["DEVICE_STATUS_PING_TIMEOUT"])
    message = "设备状态刷新完成" if result["checked_devices"] else "没有设备需要检查"
    return success(result, message=message)


@device_bp.route("/device-status/monitoring-status", methods=["GET"])
@login_required
def monitoring_status():
    return success(monitoring_snapshot(current_app.config["DEVICE_STATUS_CHECK_INTERVAL"]))


@device_bp.route("/device-status/start-monitoring", methods=["POST"])
@login_required
@require_admin
def start_monitoring():
    result = start_status_monitoring(
        current_app._get_current_object(),
        interval_seconds=current_app.config["DEVICE_STATUS_CHECK_INTERVAL"],
        timeout_seconds=current_app.config["DEVICE_STATUS_PING_TIMEOUT"],
    )
    return success(result, message="设备状态监控已启动")


@device_bp.route("/device-status/stop-monitoring", methods=["POST"])
@login_required
@require_admin
def stop_monitoring():
    result = stop_status_monitoring(current_app.config["DEVICE_STATUS_CHECK_INTERVAL"])
    return success(result, message="设备状态监控已停止")


def parse_device_payload(data):
    username = required_string(data, "username", "用户名", max_length=100)
    ip_address = validate_ip(required_string(data, "ip_address", "IP地址", max_length=45))
    mac_address = validate_mac(optional_string(data, "mac_address", max_length=28))
    details = optional_string(data, "details")
    category = optional_string(data, "category", max_length=50) or "未分类"

    return {
        "username": username,
        "ip_address": ip_address,
        "mac_address": mac_address,
        "details": details,
        "category": category,
    }


def filtered_device_query(apply_status=True):
    query = Device.query
    keyword = (request.args.get("q") or request.args.get("search") or "").strip()
    category = (request.args.get("category") or "").strip()
    status = normalize_status(request.args.get("status")) if apply_status else ""

    if keyword:
        like_value = f"%{keyword}%"
        query = query.filter(or_(
            Device.username.ilike(like_value),
            Device.ip_address.ilike(like_value),
            Device.mac_address.ilike(like_value),
            Device.category.ilike(like_value),
            Device.details.ilike(like_value),
        ))
    if category:
        query = query.filter(Device.category == category)
    if status == "online":
        query = query.filter(Device.is_online.is_(True))
    elif status == "offline":
        query = query.filter(Device.is_online.is_(False))

    return query


def device_status_counts(query):
    total = query.count()
    online = query.filter(Device.is_online.is_(True)).count()
    return {
        "all": total,
        "online": online,
        "offline": total - online,
    }


def normalize_status(value):
    status = (value or "").strip().lower()
    if status in {"online", "1", "true", "up"}:
        return "online"
    if status in {"offline", "0", "false", "down"}:
        return "offline"
    return ""


def device_categories():
    rows = db.session.query(Device.category).distinct().order_by(Device.category.asc()).all()
    return [row[0] for row in rows if row[0]]


def int_arg(name, default, min_value=None, max_value=None):
    try:
        value = int(request.args.get(name, default))
    except (TypeError, ValueError):
        value = default
    if min_value is not None:
        value = max(value, min_value)
    if max_value is not None:
        value = min(value, max_value)
    return value


def row_value(row, *names):
    normalized = {str(key).strip().lower(): value for key, value in row.items() if key is not None}
    for name in names:
        value = normalized.get(str(name).strip().lower())
        if value is not None:
            return str(value).strip()
    return ""
