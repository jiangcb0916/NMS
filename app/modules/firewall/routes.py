import re
import time

import requests
from flask import Blueprint, current_app
from flask_login import login_required

from app.common.responses import success


firewall_bp = Blueprint("firewall_api", __name__)
bandwidth_history = {}


@firewall_bp.route("/api/status/huawei-firewall", methods=["GET"])
@login_required
def huawei_firewall():
    payload = fetch_huawei_firewall_status()
    if not payload.get("configured"):
        return success(payload, message="华为防火墙 SNMP 接口未配置", code=1)
    return success(payload)


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
    payload["snmp_target"] = target
    payload["snmp_url"] = snmp_url
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
        "configured": configured,
    }


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
