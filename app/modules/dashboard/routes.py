from flask import Blueprint, current_app
from flask_login import login_required

from app.common.responses import success
from app.extensions import db
from app.models.cache import DeviceOsCache, UserNameCache
from app.models.device import Device
from app.models.user import User


dashboard_bp = Blueprint("dashboard_api", __name__)


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
    return success({
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
    })


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
