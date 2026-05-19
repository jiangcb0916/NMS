from datetime import timedelta

from flask import Blueprint
from flask_login import login_required

from app.common.responses import success
from app.extensions import db
from app.models.base import now_local
from app.models.cache import DeviceOsCache, UserNameCache
from app.modules.auth.decorators import require_admin


cache_bp = Blueprint("cache_api", __name__)


@cache_bp.route("/api/cache/os-stats", methods=["GET"])
@login_required
def os_cache_stats():
    current_time = now_local()
    total = DeviceOsCache.query.count()
    expired = DeviceOsCache.query.filter(DeviceOsCache.expires_at < current_time).count()
    top_caches = DeviceOsCache.query.order_by(DeviceOsCache.cache_hit_count.desc()).limit(10).all()
    return success({
        "total_caches": total,
        "active_caches": total - expired,
        "expired_caches": expired,
        "top_caches": [cache.to_dict() for cache in top_caches],
    })


@cache_bp.route("/api/cache/os-clean", methods=["POST"])
@login_required
@require_admin
def clean_os_cache():
    current_time = now_local()
    expired = DeviceOsCache.query.filter(DeviceOsCache.expires_at < current_time).all()
    count = len(expired)
    for cache in expired:
        db.session.delete(cache)
    db.session.commit()
    return success({"cleaned": count}, message=f"已清理 {count} 条过期缓存")


@cache_bp.route("/api/cache/os-refresh/<device_ip>", methods=["POST"])
@login_required
@require_admin
def refresh_os_cache(device_ip):
    cache = DeviceOsCache.query.filter_by(device_ip=device_ip).first()
    if cache:
        cache.expires_at = now_local() + timedelta(hours=24)
        cache.last_updated = now_local()
        db.session.commit()
        return success(cache.to_dict(), message="缓存已刷新")

    cache = DeviceOsCache(
        device_ip=device_ip,
        expires_at=now_local() + timedelta(hours=24),
    )
    db.session.add(cache)
    db.session.commit()
    return success(cache.to_dict(), message="缓存已创建")


@cache_bp.route("/api/access-control/cache-status", methods=["GET"])
@login_required
def cache_status():
    current_time = now_local()
    name_total = UserNameCache.query.count()
    name_expired = UserNameCache.query.filter(UserNameCache.expires_at < current_time).count()
    os_total = DeviceOsCache.query.count()
    os_expired = DeviceOsCache.query.filter(DeviceOsCache.expires_at < current_time).count()

    return success({
        "user_name_cache": {
            "database_cached": name_total,
            "valid_cached": name_total - name_expired,
            "cache_ttl_hours": 24,
        },
        "device_os_cache": {
            "database_cached": os_total,
            "valid_cached": os_total - os_expired,
            "cache_ttl_hours": 24,
        },
    })
