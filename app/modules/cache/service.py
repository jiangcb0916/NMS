from datetime import timedelta

from app.extensions import db
from app.models.base import now_local
from app.models.cache import DeviceOsCache


OS_FIELDS = {
    "os": ("stros",),
    "os_version": ("strosversion", "strversion"),
    "device_type": ("strdevtype",),
    "device_model": ("strdevmodel",),
    "vendor": ("strvendor",),
    "device_name": ("strdevname",),
    "mac_address": ("strmac",),
    "department": ("strdeptname",),
    "switch_name": ("strswitchname",),
    "interface": ("strifname", "strinterface"),
    "location": ("strlocation",),
}


def get_device_os_info(device_ip, device_data=None):
    if not device_ip or device_ip == "N/A":
        return default_os_info()

    cached = DeviceOsCache.query.filter_by(device_ip=device_ip).first()
    if cached and not cached.is_expired():
        cached.cache_hit_count += 1
        db.session.commit()
        return os_cache_to_dict(cached)

    if cached and cached.is_expired():
        db.session.delete(cached)
        db.session.commit()

    if not device_data:
        return default_os_info()

    os_info = extract_os_info(device_data)
    upsert_device_os_cache(device_ip, os_info, cache_hours_for(os_info))
    return os_info


def extract_os_info(row):
    info = {}
    for output_key, source_keys in OS_FIELDS.items():
        info[output_key] = first_value(row, source_keys)
    return info


def upsert_device_os_cache(device_ip, os_info, cache_hours=24):
    cache = DeviceOsCache.query.filter_by(device_ip=device_ip).first()
    if not cache:
        cache = DeviceOsCache(device_ip=device_ip)
        db.session.add(cache)

    for key, value in os_info.items():
        if hasattr(cache, key):
            setattr(cache, key, value)
    cache.expires_at = now_local() + timedelta(hours=cache_hours)
    cache.last_updated = now_local()
    db.session.commit()


def cache_hours_for(os_info):
    os_name = os_info.get("os")
    os_version = os_info.get("os_version")
    if meaningful(os_name) and meaningful(os_version):
        return 72
    if meaningful(os_name):
        return 48
    return 12


def os_cache_to_dict(cache):
    return {
        "os": cache.os or "N/A",
        "os_version": cache.os_version or "N/A",
        "device_type": cache.device_type or "N/A",
        "device_model": cache.device_model or "N/A",
        "vendor": cache.vendor or "N/A",
        "device_name": cache.device_name or "N/A",
        "mac_address": cache.mac_address or "N/A",
        "department": cache.department or "N/A",
        "switch_name": cache.switch_name or "N/A",
        "interface": cache.interface or "N/A",
        "location": cache.location or "N/A",
    }


def default_os_info():
    return {
        "os": "N/A",
        "os_version": "N/A",
        "device_type": "N/A",
        "device_model": "N/A",
        "vendor": "N/A",
        "device_name": "N/A",
        "mac_address": "N/A",
        "department": "N/A",
        "switch_name": "N/A",
        "interface": "N/A",
        "location": "N/A",
    }


def first_value(row, keys):
    for key in keys:
        value = row.get(key)
        if meaningful(value):
            return value
    return "N/A"


def meaningful(value):
    return value not in {None, "", "N/A"}
