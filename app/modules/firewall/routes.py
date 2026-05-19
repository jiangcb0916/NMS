import re
import time

import requests
from flask import Blueprint, current_app, request
from flask_login import login_required

from app.common.responses import success


firewall_bp = Blueprint("firewall_api", __name__)
bandwidth_history = {}
bandwidth_samples = []
MAX_BANDWIDTH_SAMPLES = 720


@firewall_bp.route("/api/status/huawei-firewall", methods=["GET"])
@login_required
def huawei_firewall():
    payload = fetch_huawei_firewall_status()
    if not payload.get("configured"):
        return success(payload, message="华为防火墙 SNMP 接口未配置", code=1)
    return success(payload)


@firewall_bp.route("/api/status/huawei-firewall/bandwidth-history", methods=["GET"])
@login_required
def huawei_firewall_bandwidth_history():
    limit = int_arg("limit", default=180, minimum=10, maximum=MAX_BANDWIDTH_SAMPLES)
    range_key, range_seconds = range_arg()
    refresh = (request.args.get("refresh") or "1").lower() in {"1", "true", "yes", "on"}
    latest = latest_bandwidth_payload()

    if refresh:
        try:
            latest = fetch_huawei_firewall_status()
        except Exception as exc:
            current_app.logger.warning("华为防火墙带宽历史刷新失败: %s", exc)
            latest["ok"] = False
            latest["error"] = str(exc)

    samples = query_prometheus_bandwidth_range(range_key, range_seconds)
    if not samples:
        samples = filter_samples_by_range(range_seconds)
    samples = samples[-limit:]
    if samples:
        latest.update(samples[-1])
    return success({
        "latest": latest,
        "samples": samples,
        "sample_count": len(samples),
        "total_sample_count": len(bandwidth_samples),
        "range": range_key,
        "range_seconds": range_seconds,
        "configured": bool(latest.get("configured")),
    })


def fetch_huawei_firewall_status(timeout=10):
    config = current_app.config
    snmp_url = config.get("HUAWEI_SNMP_URL")
    target = config.get("HUAWEI_FIREWALL_TARGET")
    if not snmp_url or not target:
        return default_payload(configured=False)

    response = requests.get(snmp_url, params={
        "auth": config.get("HUAWEI_SNMP_AUTH"),
        "module": config.get("HUAWEI_SNMP_MODULE"),
        "target": target,
    }, timeout=timeout)
    response.raise_for_status()
    content = response.text
    payload = default_payload(configured=True)
    payload["cpu_usage"] = round(extract_number(content, r"hwCpuUsagePercent\s+([\d.]+)"), 1)
    payload["memory_usage"] = round(extract_number(content, r"hwMemUsagePercent\s+([\d.]+)"), 1)
    payload.update(calculate_bandwidth(content, config.get("HUAWEI_TOTAL_BANDWIDTH_MBPS", 450)))
    payload["timestamp"] = time.time()
    payload["snmp_target"] = target
    payload["snmp_url"] = snmp_url
    payload["ok"] = True
    payload["error"] = ""
    append_bandwidth_sample(payload)
    return payload


def default_payload(configured):
    return {
        "cpu_usage": 0,
        "memory_usage": 0,
        "total_bandwidth": current_app.config.get("HUAWEI_TOTAL_BANDWIDTH_MBPS", 450),
        "telecom_upload": 0,
        "telecom_download": 0,
        "unicom_upload": 0,
        "unicom_download": 0,
        "total_upload": 0,
        "total_download": 0,
        "upload_utilization": 0,
        "download_utilization": 0,
        "bandwidth_utilization": 0,
        "snmp_target": current_app.config.get("HUAWEI_FIREWALL_TARGET"),
        "snmp_url": current_app.config.get("HUAWEI_SNMP_URL"),
        "timestamp": time.time(),
        "ok": False,
        "error": "",
        "configured": configured,
    }


def latest_bandwidth_payload():
    payload = default_payload(configured=bool(
        current_app.config.get("HUAWEI_SNMP_URL") and current_app.config.get("HUAWEI_FIREWALL_TARGET")
    ))
    if bandwidth_samples:
        payload.update(bandwidth_samples[-1])
        payload["configured"] = True
        payload["ok"] = True
    return payload


def extract_number(text, pattern):
    match = re.search(pattern, text)
    return float(match.group(1)) if match else 0


def calculate_bandwidth(content, total_bandwidth):
    global bandwidth_history
    now = time.time()
    current = {
        "telecom_in": extract_number(content, r"telecom_ifInOctets_total\s+([\d.]+(?:[eE][+-]?\d+)?)"),
        "telecom_out": extract_number(content, r"telecom_ifOutOctets_total\s+([\d.]+(?:[eE][+-]?\d+)?)"),
        "unicom_in": extract_number(content, r"unicom_ifInOctets_total\s+([\d.]+(?:[eE][+-]?\d+)?)"),
        "unicom_out": extract_number(content, r"unicom_ifOutOctets_total\s+([\d.]+(?:[eE][+-]?\d+)?)"),
    }

    if not bandwidth_history:
        bandwidth_history = {"time": now, **current}
        return {
            "telecom_upload": 0,
            "telecom_download": 0,
            "unicom_upload": 0,
            "unicom_download": 0,
            "total_upload": 0,
            "total_download": 0,
            "upload_utilization": 0,
            "download_utilization": 0,
            "bandwidth_utilization": 0,
        }

    time_diff = max(now - bandwidth_history["time"], 1)
    telecom_download = mbps(current["telecom_in"], bandwidth_history["telecom_in"], time_diff)
    telecom_upload = mbps(current["telecom_out"], bandwidth_history["telecom_out"], time_diff)
    unicom_download = mbps(current["unicom_in"], bandwidth_history["unicom_in"], time_diff)
    unicom_upload = mbps(current["unicom_out"], bandwidth_history["unicom_out"], time_diff)
    bandwidth_history = {"time": now, **current}

    total_upload = telecom_upload + unicom_upload
    total_download = telecom_download + unicom_download
    upload_utilization = round((total_upload / total_bandwidth) * 100, 1) if total_bandwidth else 0
    download_utilization = round((total_download / total_bandwidth) * 100, 1) if total_bandwidth else 0
    return {
        "telecom_upload": telecom_upload,
        "telecom_download": telecom_download,
        "unicom_upload": unicom_upload,
        "unicom_download": unicom_download,
        "total_upload": round(total_upload, 1),
        "total_download": round(total_download, 1),
        "upload_utilization": upload_utilization,
        "download_utilization": download_utilization,
        "bandwidth_utilization": max(upload_utilization, download_utilization),
    }


def mbps(current, previous, seconds):
    return round(max(0, current - previous) / seconds / 125000, 1)


def append_bandwidth_sample(payload):
    sample = {
        "timestamp": payload.get("timestamp", time.time()),
        "telecom_upload": payload.get("telecom_upload", 0),
        "telecom_download": payload.get("telecom_download", 0),
        "unicom_upload": payload.get("unicom_upload", 0),
        "unicom_download": payload.get("unicom_download", 0),
        "total_upload": payload.get("total_upload", 0),
        "total_download": payload.get("total_download", 0),
        "upload_utilization": payload.get("upload_utilization", 0),
        "download_utilization": payload.get("download_utilization", 0),
        "cpu_usage": payload.get("cpu_usage", 0),
        "memory_usage": payload.get("memory_usage", 0),
    }
    bandwidth_samples.append(sample)
    if len(bandwidth_samples) > MAX_BANDWIDTH_SAMPLES:
        del bandwidth_samples[:-MAX_BANDWIDTH_SAMPLES]


def int_arg(name, default, minimum, maximum):
    value = request.args.get(name)
    try:
        parsed = int(value) if value is not None else default
    except (TypeError, ValueError):
        parsed = default
    return max(minimum, min(maximum, parsed))


def range_arg():
    value = (request.args.get("range") or "6h").strip().lower()
    ranges = {
        "5m": 5 * 60,
        "15m": 15 * 60,
        "30m": 30 * 60,
        "1h": 60 * 60,
        "3h": 3 * 60 * 60,
        "6h": 6 * 60 * 60,
        "12h": 12 * 60 * 60,
        "24h": 24 * 60 * 60,
        "2d": 2 * 24 * 60 * 60,
    }
    if value not in ranges:
        value = "6h"
    return value, ranges[value]


def filter_samples_by_range(range_seconds):
    if not bandwidth_samples:
        return []
    cutoff = time.time() - range_seconds
    return [sample for sample in bandwidth_samples if sample.get("timestamp", 0) >= cutoff]


def query_prometheus_bandwidth_range(range_key, range_seconds):
    query_url = current_app.config.get("PROMETHEUS_QUERY_URL")
    if not query_url:
        return []

    query_range_url = prometheus_query_range_url(query_url)
    end = int(time.time())
    start = end - range_seconds
    step = prometheus_step(range_key)
    rate_window = prometheus_rate_window(range_key)
    labels = firewall_prometheus_labels()
    metrics = {
        "telecom_upload": "telecom_ifOutOctets_total",
        "telecom_download": "telecom_ifInOctets_total",
        "unicom_upload": "unicom_ifOutOctets_total",
        "unicom_download": "unicom_ifInOctets_total",
    }
    series_values = {}

    for key, metric_name in metrics.items():
        expression = f'rate({metric_name}{{{labels}}}[{rate_window}]) * 8 / 1000000'
        try:
            response = requests.get(query_range_url, params={
                "query": expression,
                "start": start,
                "end": end,
                "step": step,
            }, timeout=8)
            response.raise_for_status()
            payload = response.json()
        except Exception as exc:
            current_app.logger.warning("Prometheus 防火墙带宽历史查询失败: %s %s", key, exc)
            return []

        if payload.get("status") != "success":
            return []
        results = payload.get("data", {}).get("result", [])
        if not results:
            series_values[key] = []
            continue
        series_values[key] = results[0].get("values", [])

    samples_by_time = {}
    for key, values in series_values.items():
        for raw_timestamp, raw_value in values:
            timestamp = int(float(raw_timestamp))
            sample = samples_by_time.setdefault(timestamp, {"timestamp": timestamp})
            sample[key] = round(float(raw_value), 2)

    total_bandwidth = current_app.config.get("HUAWEI_TOTAL_BANDWIDTH_MBPS", 450)
    samples = []
    for timestamp in sorted(samples_by_time):
        sample = samples_by_time[timestamp]
        telecom_upload = sample.get("telecom_upload", 0)
        telecom_download = sample.get("telecom_download", 0)
        unicom_upload = sample.get("unicom_upload", 0)
        unicom_download = sample.get("unicom_download", 0)
        total_upload = telecom_upload + unicom_upload
        total_download = telecom_download + unicom_download
        sample.update({
            "telecom_upload": telecom_upload,
            "telecom_download": telecom_download,
            "unicom_upload": unicom_upload,
            "unicom_download": unicom_download,
            "total_upload": round(total_upload, 2),
            "total_download": round(total_download, 2),
            "upload_utilization": round((total_upload / total_bandwidth) * 100, 1) if total_bandwidth else 0,
            "download_utilization": round((total_download / total_bandwidth) * 100, 1) if total_bandwidth else 0,
        })
        samples.append(sample)
    return samples


def prometheus_query_range_url(query_url):
    if query_url.endswith("/query"):
        return query_url[:-len("/query")] + "/query_range"
    return query_url.rstrip("/") + "_range"


def prometheus_step(range_key):
    return {
        "5m": 10,
        "15m": 15,
        "30m": 30,
        "1h": 60,
        "3h": 120,
        "6h": 180,
        "12h": 300,
        "24h": 600,
        "2d": 1200,
    }.get(range_key, 180)


def prometheus_rate_window(range_key):
    return "2m" if range_key in {"5m", "15m", "30m", "1h"} else "5m"


def firewall_prometheus_labels():
    config = current_app.config
    labels = {
        "auth": config.get("HUAWEI_SNMP_AUTH"),
        "instance": config.get("HUAWEI_FIREWALL_TARGET"),
        "job": config.get("HUAWEI_PROMETHEUS_JOB"),
        "module": config.get("HUAWEI_SNMP_MODULE"),
    }
    return ",".join(
        f'{key}="{escape_label_value(value)}"'
        for key, value in labels.items()
        if value
    )


def escape_label_value(value):
    return str(value).replace("\\", "\\\\").replace('"', '\\"')
