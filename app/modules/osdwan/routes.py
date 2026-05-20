from datetime import datetime
import re
import time
from urllib.parse import urljoin

import requests
from flask import Blueprint, current_app, request
from flask_login import login_required

from app.common.responses import success


osdwan_bp = Blueprint("osdwan_api", __name__)


@osdwan_bp.route("/api/osdwan/overview", methods=["GET"])
@login_required
def osdwan_overview():
    client = WanFlowClient()
    if not client.configured:
        return success(default_overview(configured=False), message="OSDWAN Token 未配置", code=1)

    all_period = request.args.get("all_period") or current_app.config.get("OSDWAN_ALL_STATS_PERIOD", "1day")
    node_period = request.args.get("node_period") or current_app.config.get("OSDWAN_NODE_STATS_PERIOD", "6hours")
    node_id = request.args.get("node_id") or current_app.config.get("OSDWAN_NODE_ID", "2168")
    node_name = current_app.config.get("OSDWAN_NODE_NAME", "办公开发")
    view_type = request.args.get("view_type") or current_app.config.get("OSDWAN_NODE_VIEW_TYPE", "total")
    user_page = bounded_int(request.args.get("user_page"), 1, 1, 500)
    user_per_page = bounded_int(request.args.get("user_per_page"), 10, 1, 200)
    user_query = (request.args.get("user_q") or request.args.get("q") or "").strip()

    users_result, users_error = safe_load_users(
        client,
        page=user_page,
        per_page=user_per_page,
        query=user_query,
    )
    all_stats_payload, all_stats_error = safe_get(
        client,
        "整体 SaaS 带宽",
        "/api/Saas/all-network-stats",
        params={"period": all_period},
    )
    node_stats_payload, node_stats_error = safe_get(
        client,
        f"{node_name}带宽",
        f"/api/Saas/network-stats/{node_id}",
        params={"period": node_period, "view_type": view_type},
    )

    users = users_result["users"] if users_result is not None else []
    user_pagination = users_result["pagination"] if users_result is not None else empty_pagination(user_page, user_per_page)
    user_people = users_result["people"] if users_result is not None else []
    all_stats = normalize_bandwidth_stats(all_stats_payload) if all_stats_payload is not None else normalize_bandwidth_stats({})
    node_stats = normalize_bandwidth_stats(node_stats_payload) if node_stats_payload is not None else normalize_bandwidth_stats({})
    errors = {
        key: value
        for key, value in {
            "users": users_error,
            "all_stats": all_stats_error,
            "node_stats": node_stats_error,
        }.items()
        if value
    }
    if users_result is None and all_stats_payload is None and node_stats_payload is None:
        payload = default_overview(configured=True)
        payload["errors"] = errors
        return success(payload, message="OSDWAN 后台接口请求失败", code=1)

    return success({
        "configured": True,
        "service": "WANFlow OSDWAN",
        "users": users,
        "user_count": user_pagination["total"],
        "user_pagination": user_pagination,
        "user_query": user_query,
        "user_people": user_people,
        "user_people_count": len(user_people),
        "errors": errors,
        "all_stats": all_stats,
        "node": {
            "id": node_id,
            "name": node_name,
            "period": node_period,
            "view_type": view_type,
            "stats": node_stats,
        },
        "all_period": all_period,
        "queried_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
    })


class WanFlowClient:
    def __init__(self):
        config = current_app.config
        self.base_url = (config.get("OSDWAN_API_BASE_URL") or "https://api.wanflow.com").rstrip("/")
        self.origin = (config.get("OSDWAN_CONSOLE_ORIGIN") or "https://console.wanflow.com").rstrip("/")
        self.token = config.get("OSDWAN_TOKEN")
        self.timeout = config.get("OSDWAN_TIMEOUT", 15)

    @property
    def configured(self):
        return bool(self.token)

    def get(self, path, params=None):
        response = requests.get(
            urljoin(f"{self.base_url}/", path.lstrip("/")),
            params=params,
            headers=self.headers(),
            timeout=self.timeout,
        )
        response.raise_for_status()
        return response.json()

    def headers(self):
        return {
            "Authorization": f"Bearer {self.token}",
            "Accept": "application/json, text/plain, */*",
            "Origin": self.origin,
            "Referer": f"{self.origin}/",
            "User-Agent": "Mozilla/5.0",
        }


def safe_get(client, label, path, params=None):
    try:
        return client.get(path, params=params), ""
    except requests.HTTPError as exc:
        status_code = exc.response.status_code if exc.response is not None else "unknown"
        message = response_error_message(exc.response)
        current_app.logger.warning("OSDWAN %s failed: HTTP %s", label, status_code)
        return None, f"{label}接口返回 HTTP {status_code}: {message}"
    except requests.RequestException as exc:
        current_app.logger.warning("OSDWAN %s failed: %s", label, exc.__class__.__name__)
        return None, f"{label}接口请求失败: {exc.__class__.__name__}"


def safe_load_users(client, page, per_page, query):
    try:
        return load_user_collection(client, page, per_page, query), ""
    except requests.HTTPError as exc:
        status_code = exc.response.status_code if exc.response is not None else "unknown"
        message = response_error_message(exc.response)
        current_app.logger.warning("OSDWAN 用户列表 failed: HTTP %s", status_code)
        return None, f"用户列表接口返回 HTTP {status_code}: {message}"
    except requests.RequestException as exc:
        current_app.logger.warning("OSDWAN 用户列表 failed: %s", exc.__class__.__name__)
        return None, f"用户列表接口请求失败: {exc.__class__.__name__}"


def response_error_message(response):
    if response is None:
        return "无响应内容"
    try:
        payload = response.json()
    except ValueError:
        return response.text[:160] or "无响应内容"
    message = payload.get("message") if isinstance(payload, dict) else ""
    return str(message or payload)[:160]


def bounded_int(value, default, minimum, maximum):
    try:
        number = int(value)
    except (TypeError, ValueError):
        number = default
    return max(minimum, min(maximum, number))


def normalize_users(payload):
    rows = extract_record_list(payload)
    users = []
    for index, row in enumerate(rows, start=1):
        if not isinstance(row, dict):
            continue
        users.append({
            "id": string_value(first_value(row, ["id", "user_id", "uid"]) or index),
            "username": string_value(first_value(row, ["username", "account", "userName", "name", "phone", "mobile", "email"])),
            "display_name": string_value(first_value(row, ["display_name", "nickname", "real_name", "realName", "full_name", "face_cert_name", "name"])),
            "email": string_value(first_value(row, ["email", "mail"])),
            "role": string_value(first_value(row, ["role", "roles", "role_name", "roleName", "type"])),
            "status": normalize_user_status(row),
            "last_login": format_time_value(first_value(row, ["last_login", "lastLogin", "last_seen", "updated_at", "updatedAt"])),
        })
    return users


def load_user_collection(client, page, per_page, query):
    fetch_per_page = 200
    first_payload = client.get("/api/user", params={"page": 1, "per_page": fetch_per_page, "no_cache": 1})
    rows = extract_record_list(first_payload)
    pagination = extract_pagination(first_payload, 1, fetch_per_page, len(rows))
    remote_pages = min(max(1, pagination["pages"]), 20)

    for page_number in range(2, remote_pages + 1):
        payload = client.get(
            "/api/user",
            params={"page": page_number, "per_page": fetch_per_page, "no_cache": 1},
        )
        rows.extend(extract_record_list(payload))

    all_users = normalize_users({"data": rows})
    filtered_users = filter_users(all_users, query)
    page_users, local_pagination = paginate_items(filtered_users, page, per_page)
    return {
        "users": page_users,
        "pagination": local_pagination,
        "people": summarize_user_people(filtered_users),
    }


def filter_users(users, query):
    if not query:
        return users
    needle = query.lower()
    filtered = []
    for user in users:
        haystack = " ".join([
            user.get("id", ""),
            user.get("username", ""),
            user.get("display_name", ""),
            user.get("email", ""),
            user.get("role", ""),
            user.get("status", ""),
            user.get("last_login", ""),
        ]).lower()
        if needle in haystack:
            filtered.append(user)
    return filtered


def paginate_items(items, page, per_page):
    total = len(items)
    pages = (total + per_page - 1) // per_page if total else 0
    page = min(page, pages) if pages else 1
    start = (page - 1) * per_page
    rows = items[start:start + per_page]
    return rows, {
        "total": total,
        "page": page,
        "per_page": per_page,
        "pages": pages,
        "returned": len(rows),
    }


def summarize_user_people(users):
    people = {}
    for user in users:
        account = user.get("username") or user.get("display_name") or user.get("email") or user.get("id")
        for name in split_person_names(account):
            entry = people.setdefault(name, {
                "name": name,
                "accounts": [],
                "emails": [],
                "roles": [],
                "statuses": [],
            })
            append_unique(entry["accounts"], account)
            append_unique(entry["emails"], user.get("email"))
            append_unique(entry["roles"], user.get("role"))
            append_unique(entry["statuses"], user.get("status"))

    return [
        {
            "name": item["name"],
            "account_count": len(item["accounts"]),
            "accounts": "、".join(item["accounts"]),
            "emails": "、".join(item["emails"]),
            "roles": "、".join(item["roles"]),
            "statuses": "、".join(item["statuses"]),
        }
        for item in people.values()
    ]


def split_person_names(value):
    parts = [part.strip() for part in re.split(r"[/／]+", string_value(value)) if part.strip()]
    return parts or [string_value(value)] if string_value(value) else []


def append_unique(items, value):
    text = string_value(value)
    if text and text not in items:
        items.append(text)


def normalize_user_status(row):
    explicit = first_value(row, ["status", "state", "enabled", "is_active", "active"])
    if explicit is not None:
        return string_value(explicit)
    if first_value(row, ["departure_time", "departureTime"]):
        return "已离职"
    face_verified = row.get("face_verified")
    if face_verified is True:
        return "已实名"
    if face_verified is False:
        return "未实名"
    return ""


def normalize_bandwidth_stats(payload):
    records = extract_timeseries_records(payload)
    samples = []
    for index, record in enumerate(records):
        sample = bandwidth_sample(record, index)
        if sample:
            samples.append(sample)

    samples = sorted(samples, key=lambda item: item.get("timestamp") or 0)
    latest = samples[-1] if samples else {}
    return {
        "samples": samples,
        "sample_count": len(samples),
        "latest": latest,
        "summary": compact_summary(payload),
    }


def bandwidth_sample(record, index):
    if not isinstance(record, dict):
        return None
    timestamp = timestamp_value(first_value(record, [
        "timestamp", "time", "time_point", "timePoint", "ts", "date", "datetime", "created_at", "createdAt",
    ]))
    if not timestamp:
        timestamp = int(time.time()) - max(0, 300 * index)

    download = metric_from_record(record, [
        "download", "down", "downstream", "receive", "recv", "rx", "in", "inbound",
        "total_in", "totalIn", "download_bandwidth", "rx_bandwidth",
    ])
    upload = metric_from_record(record, [
        "upload", "up", "upstream", "send", "tx", "out", "outbound",
        "total_out", "totalOut", "upload_bandwidth", "tx_bandwidth",
    ])
    if download is None and upload is None:
        return None
    download = download or 0
    upload = upload or 0
    return {
        "timestamp": timestamp,
        "time": format_time_value(timestamp),
        "download_mbps": round(download, 3),
        "upload_mbps": round(upload, 3),
        "download_rate": format_mbps(download),
        "upload_rate": format_mbps(upload),
    }


def metric_from_record(record, aliases):
    flattened = flatten_dict(record)
    for key, value in flattened.items():
        lower_key = key.lower()
        if any(key_matches_alias(lower_key, alias.lower()) for alias in aliases):
            parsed = bandwidth_to_mbps(value, lower_key)
            if parsed is not None:
                return parsed
    return None


def key_matches_alias(key, alias):
    if len(alias) <= 3:
        tokens = key.replace(".", "_").replace("-", "_").split("_")
        return alias in tokens
    return alias in key


def bandwidth_to_mbps(value, key):
    number = numeric_value(value)
    if number is None:
        return None
    if "gbps" in key or "gbit" in key:
        return number * 1000
    if "kbps" in key or "kbit" in key:
        return number / 1000
    if "mbps" in key or "mbit" in key:
        return number
    if "byte" in key or "octet" in key:
        return number * 8 / 1_000_000
    if "bps" in key or "bit" in key or "bandwidth" in key or "speed" in key:
        return number / 1_000_000 if number > 10_000 else number
    return number / 1_000_000 if number > 1_000_000 else number


def extract_record_list(payload):
    if isinstance(payload, list):
        return payload
    if not isinstance(payload, dict):
        return []
    for key in ["data", "rows", "list", "users", "items", "records", "result"]:
        value = payload.get(key)
        if isinstance(value, list):
            return value
        if isinstance(value, dict):
            nested = extract_record_list(value)
            if nested:
                return nested
    return []


def extract_pagination(payload, page, per_page, returned):
    pagination = {}
    if isinstance(payload, dict):
        for key in ["pagination", "meta", "page_info", "pageInfo"]:
            value = payload.get(key)
            if isinstance(value, dict):
                pagination = value
                break

    total = int_value(first_value(pagination, ["total", "total_count", "totalCount", "count"]))
    pages = int_value(first_value(pagination, ["last_page", "lastPage", "pages", "page_count", "pageCount"]))
    current_page = int_value(first_value(pagination, ["current_page", "currentPage", "page"]))
    page_size = int_value(first_value(pagination, ["per_page", "perPage", "page_size", "pageSize"]))
    return {
        "total": total if total is not None else returned,
        "page": current_page or page,
        "per_page": page_size or per_page,
        "pages": pages or 1,
        "returned": returned,
    }


def empty_pagination(page, per_page):
    return {
        "total": 0,
        "page": page,
        "per_page": per_page,
        "pages": 0,
        "returned": 0,
    }


def extract_timeseries_records(payload):
    candidates = []
    collect_lists(payload, candidates)
    scored = []
    for records in candidates:
        dict_records = [item for item in records if isinstance(item, dict)]
        if not dict_records:
            continue
        score = sum(timeseries_score(item) for item in dict_records[:5]) + min(len(dict_records), 20)
        scored.append((score, dict_records))
    if not scored and isinstance(payload, dict):
        return [payload]
    scored.sort(key=lambda item: item[0], reverse=True)
    return scored[0][1] if scored and scored[0][0] > 0 else []


def collect_lists(value, output):
    if isinstance(value, list):
        output.append(value)
        for item in value:
            collect_lists(item, output)
    elif isinstance(value, dict):
        for item in value.values():
            collect_lists(item, output)


def timeseries_score(record):
    flattened = flatten_dict(record)
    score = 0
    for key in flattened:
        lower_key = key.lower()
        if any(word in lower_key for word in ["time", "date", "timestamp"]):
            score += 3
        if any(word in lower_key for word in ["upload", "download", "rx", "tx", "inbound", "outbound", "bandwidth", "speed"]):
            score += 2
    return score


def flatten_dict(value, prefix=""):
    result = {}
    if not isinstance(value, dict):
        return result
    for key, item in value.items():
        full_key = f"{prefix}.{key}" if prefix else str(key)
        if isinstance(item, dict):
            result.update(flatten_dict(item, full_key))
        else:
            result[full_key] = item
    return result


def first_value(row, keys):
    for key in keys:
        value = row.get(key)
        if value is not None and value != "":
            return value
    return None


def numeric_value(value):
    if isinstance(value, dict):
        return numeric_value(first_value(value, ["value", "num", "number", "data"]))
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def int_value(value):
    number = numeric_value(value)
    return int(number) if number is not None else None


def timestamp_value(value):
    if value is None or value == "":
        return 0
    if isinstance(value, (int, float)):
        number = float(value)
        return int(number / 1000) if number > 10_000_000_000 else int(number)
    text = str(value).strip()
    if text.isdigit():
        return timestamp_value(float(text))
    try:
        return int(datetime.fromisoformat(text.replace("Z", "+00:00")).timestamp())
    except ValueError:
        return 0


def format_time_value(value):
    timestamp = timestamp_value(value)
    if not timestamp:
        return string_value(value)
    return datetime.fromtimestamp(timestamp).strftime("%Y-%m-%d %H:%M:%S")


def format_mbps(value):
    number = numeric_value(value) or 0
    if number >= 1000:
        return f"{number / 1000:.2f} Gbps"
    if 0 < number < 1:
        return f"{number * 1000:.0f} Kbps"
    return f"{number:.2f} Mbps"


def string_value(value):
    if value is None:
        return ""
    if isinstance(value, bool):
        return "启用" if value else "停用"
    if isinstance(value, (list, tuple)):
        items = []
        for item in value:
            item_value = first_value(item, ["name", "label", "value", "role"]) if isinstance(item, dict) else item
            text = string_value(item_value)
            if text:
                items.append(text)
        return " / ".join(items)
    return str(value)


def compact_summary(payload):
    if isinstance(payload, dict):
        summary = {}
        for key, value in payload.items():
            if isinstance(value, (str, int, float, bool)) or value is None:
                summary[key] = value
            if len(summary) >= 8:
                break
        return summary
    if isinstance(payload, list):
        return {"records": len(payload)}
    return {}


def default_overview(configured):
    return {
        "configured": configured,
        "service": "WANFlow OSDWAN",
        "users": [],
        "user_count": 0,
        "user_query": "",
        "user_pagination": {
            "total": 0,
            "page": 1,
            "per_page": 10,
            "pages": 1,
            "returned": 0,
        },
        "user_people": [],
        "user_people_count": 0,
        "errors": {},
        "all_stats": normalize_bandwidth_stats({}),
        "node": {
            "id": current_app.config.get("OSDWAN_NODE_ID", "2168"),
            "name": current_app.config.get("OSDWAN_NODE_NAME", "办公开发"),
            "period": current_app.config.get("OSDWAN_NODE_STATS_PERIOD", "6hours"),
            "view_type": current_app.config.get("OSDWAN_NODE_VIEW_TYPE", "total"),
            "stats": normalize_bandwidth_stats({}),
        },
        "all_period": current_app.config.get("OSDWAN_ALL_STATS_PERIOD", "1day"),
        "queried_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
    }
