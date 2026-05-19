import re
import threading
from datetime import timedelta

from flask import current_app

from app.models.base import format_datetime, now_local
from app.models.cache import UserNameCache
from app.modules.integrations.dingtalk import DingTalkClient


MOBILE_RE = re.compile(r"^1\d{10}$")
MAX_CACHE_QUERY_SIZE = 500
DEFAULT_REFRESH_BATCH_SIZE = 200
FAILED_MOBILE_RETRY_SECONDS = 60 * 60

CLIENT_NAME_REFRESH_LOCK = threading.Lock()
CLIENT_NAME_REFRESH_STATE = {
    "running": False,
    "queued_mobiles": set(),
    "failed_mobiles": {},
    "last_started_at": None,
    "last_finished_at": None,
    "last_batch_size": 0,
    "last_success_count": 0,
    "last_error": None,
}


def extract_mobile(value):
    text = str(value or "").strip()
    return text if MOBILE_RE.fullmatch(text) else None


def extract_client_mobiles(rows):
    mobiles = []
    seen = set()
    for row in rows:
        mobile = extract_mobile(row.get("strusername"))
        if mobile and mobile not in seen:
            seen.add(mobile)
            mobiles.append(mobile)
    return mobiles


def valid_name_cache_map(mobiles):
    result = {}
    mobile_list = [mobile for mobile in dict.fromkeys(mobiles) if extract_mobile(mobile)]
    for chunk in chunked(mobile_list, MAX_CACHE_QUERY_SIZE):
        cached_rows = UserNameCache.query.filter(UserNameCache.mobile.in_(chunk)).all()
        for cached in cached_rows:
            if not cached.is_expired():
                result[cached.mobile] = cached.real_name
    return result


def schedule_client_name_cache_refresh(mobiles):
    mobile_list = [mobile for mobile in dict.fromkeys(mobiles) if extract_mobile(mobile)]
    if not mobile_list:
        return refresh_snapshot(configured=DingTalkClient().configured, missing_count=0)

    configured = DingTalkClient().configured
    cached_names = valid_name_cache_map(mobile_list)
    missing_mobiles = [
        mobile for mobile in mobile_list
        if mobile not in cached_names and not failed_recently(mobile)
    ]

    if not configured or not missing_mobiles:
        return refresh_snapshot(configured=configured, missing_count=len(missing_mobiles))

    app = current_app._get_current_object()
    with CLIENT_NAME_REFRESH_LOCK:
        CLIENT_NAME_REFRESH_STATE["queued_mobiles"].update(missing_mobiles)
        queued_count = len(CLIENT_NAME_REFRESH_STATE["queued_mobiles"])
        already_running = CLIENT_NAME_REFRESH_STATE["running"]
        if not already_running:
            CLIENT_NAME_REFRESH_STATE["running"] = True
            CLIENT_NAME_REFRESH_STATE["last_started_at"] = now_local()
            CLIENT_NAME_REFRESH_STATE["last_error"] = None

    if already_running:
        return refresh_snapshot(
            configured=configured,
            missing_count=len(missing_mobiles),
            queued_count=queued_count,
        )

    thread = threading.Thread(target=refresh_client_name_cache_worker, args=(app,), daemon=True)
    thread.start()
    return refresh_snapshot(configured=configured, missing_count=len(missing_mobiles), queued_count=queued_count)


def refresh_client_name_cache_worker(app):
    with app.app_context():
        batch_size = int(current_app.config.get("CLIENT_NAME_CACHE_BATCH_SIZE", DEFAULT_REFRESH_BATCH_SIZE))
        batch_size = max(1, min(batch_size, 1000))
        while True:
            mobiles = next_refresh_batch(batch_size)
            if not mobiles:
                finish_refresh()
                return

            dingtalk = DingTalkClient()
            success_count = 0
            for mobile in mobiles:
                try:
                    if dingtalk.get_name_by_mobile(mobile):
                        success_count += 1
                        clear_failed_mobile(mobile)
                    else:
                        mark_failed_mobile(mobile)
                except Exception as exc:
                    current_app.logger.warning("刷新客户端姓名缓存失败: %s %s", mobile, exc)
                    mark_failed_mobile(mobile)
                    remember_refresh_error(str(exc))

            remember_refresh_batch(len(mobiles), success_count)


def next_refresh_batch(batch_size):
    with CLIENT_NAME_REFRESH_LOCK:
        queued = CLIENT_NAME_REFRESH_STATE["queued_mobiles"]
        if not queued:
            return []
        mobiles = sorted(queued)[:batch_size]
        queued.difference_update(mobiles)
        return mobiles


def finish_refresh():
    with CLIENT_NAME_REFRESH_LOCK:
        CLIENT_NAME_REFRESH_STATE["running"] = False
        CLIENT_NAME_REFRESH_STATE["last_finished_at"] = now_local()


def remember_refresh_batch(batch_size, success_count):
    with CLIENT_NAME_REFRESH_LOCK:
        CLIENT_NAME_REFRESH_STATE["last_batch_size"] = batch_size
        CLIENT_NAME_REFRESH_STATE["last_success_count"] = success_count


def remember_refresh_error(message):
    with CLIENT_NAME_REFRESH_LOCK:
        CLIENT_NAME_REFRESH_STATE["last_error"] = message[:200]


def mark_failed_mobile(mobile):
    with CLIENT_NAME_REFRESH_LOCK:
        CLIENT_NAME_REFRESH_STATE["failed_mobiles"][mobile] = now_local()


def clear_failed_mobile(mobile):
    with CLIENT_NAME_REFRESH_LOCK:
        CLIENT_NAME_REFRESH_STATE["failed_mobiles"].pop(mobile, None)


def failed_recently(mobile):
    retry_after = now_local() - timedelta(seconds=FAILED_MOBILE_RETRY_SECONDS)
    with CLIENT_NAME_REFRESH_LOCK:
        last_failed_at = CLIENT_NAME_REFRESH_STATE["failed_mobiles"].get(mobile)
        if not last_failed_at:
            return False
        if last_failed_at < retry_after:
            CLIENT_NAME_REFRESH_STATE["failed_mobiles"].pop(mobile, None)
            return False
        return True


def refresh_snapshot(configured, missing_count=0, queued_count=None):
    with CLIENT_NAME_REFRESH_LOCK:
        queued = queued_count
        if queued is None:
            queued = len(CLIENT_NAME_REFRESH_STATE["queued_mobiles"])
        return {
            "configured": configured,
            "running": CLIENT_NAME_REFRESH_STATE["running"],
            "queued": queued,
            "missing": missing_count,
            "last_started_at": format_datetime(CLIENT_NAME_REFRESH_STATE["last_started_at"]),
            "last_finished_at": format_datetime(CLIENT_NAME_REFRESH_STATE["last_finished_at"]),
            "last_batch_size": CLIENT_NAME_REFRESH_STATE["last_batch_size"],
            "last_success_count": CLIENT_NAME_REFRESH_STATE["last_success_count"],
            "last_error": CLIENT_NAME_REFRESH_STATE["last_error"],
        }


def chunked(items, size):
    for index in range(0, len(items), size):
        yield items[index:index + size]
