import time

import requests
from flask import Blueprint, current_app
from flask_login import login_required

from app.common.responses import success
from app.modules.integrations.dingtalk import DingTalkClient
from app.modules.sangfor_ac.client import SangforACClient


integration_status_bp = Blueprint("integration_status_api", __name__, url_prefix="/api/integrations")


@integration_status_bp.route("/status", methods=["GET"])
@login_required
def integration_status():
    return success([
        check_sangfor_ac(),
        check_prometheus_query(),
        check_prometheus_metrics(),
        check_huawei_snmp(),
        check_access_control(),
        check_dingtalk(),
    ])


def check_sangfor_ac():
    def probe():
        payload = SangforACClient(timeout=3).get_online_users()
        ok = payload.get("code") == 0
        return ok, "已连接" if ok else payload.get("message", "调用失败"), {}

    return run_probe("sangfor_ac", "深信服 AC", configured=bool(current_app.config.get("SANGFOR_AC_HOST")), probe=probe)


def check_prometheus_query():
    url = current_app.config.get("PROMETHEUS_QUERY_URL")

    def probe():
        response = requests.get(url, params={"query": "up"}, timeout=3)
        payload = response.json()
        count = len(payload.get("data", {}).get("result", []))
        ok = response.status_code == 200 and payload.get("status") == "success"
        return ok, f"查询成功，样本 {count} 条" if ok else "查询失败", {"result_count": count}

    return run_probe("prometheus_query", "Prometheus 查询", configured=bool(url), probe=probe)


def check_prometheus_metrics():
    url = current_app.config.get("PROMETHEUS_METRICS_URL")

    def probe():
        response = requests.get(url, timeout=3)
        text = response.text
        ok = response.status_code == 200 and "sf" in text[:200000]
        return ok, "指标可读取" if ok else "未识别到无线指标", {"bytes": len(text)}

    return run_probe("prometheus_metrics", "Prometheus 指标", configured=bool(url), probe=probe)


def check_huawei_snmp():
    config = current_app.config
    url = config.get("HUAWEI_SNMP_URL")
    target = config.get("HUAWEI_FIREWALL_TARGET")

    def probe():
        response = requests.get(url, params={
            "auth": config.get("HUAWEI_SNMP_AUTH"),
            "module": config.get("HUAWEI_SNMP_MODULE"),
            "target": target,
        }, timeout=3)
        text = response.text
        has_cpu = "hwCpuUsagePercent" in text
        has_bandwidth = "telecom_ifInOctets_total" in text and "unicom_ifInOctets_total" in text
        ok = response.status_code == 200 and has_cpu and has_bandwidth
        return ok, "SNMP 指标正常" if ok else "SNMP 返回缺少关键指标", {
            "has_cpu": has_cpu,
            "has_bandwidth": has_bandwidth,
        }

    return run_probe("huawei_snmp", "华为防火墙 SNMP", configured=bool(url and target), probe=probe)


def check_access_control():
    config = current_app.config
    url = config.get("ACCESS_CONTROL_API_URL")
    username = config.get("ACCESS_CONTROL_API_USERNAME")
    password = config.get("ACCESS_CONTROL_API_PASSWORD")

    def probe():
        response = requests.get(url, params={
            "act": "queryDevByParams",
            "terminaltype": "1",
            "username": username,
            "password": password,
        }, timeout=5)
        payload = response.json()
        rows = len(payload.get("rows", []))
        ok = response.status_code == 200 and payload.get("status") == "SUCCESS"
        return ok, f"查询成功，设备 {rows} 条" if ok else payload.get("msg", "查询失败"), {"rows": rows}

    return run_probe("access_control", "联软准入", configured=bool(url and username and password), probe=probe)


def check_dingtalk():
    client = DingTalkClient()

    def probe():
        token = client.get_token()
        return bool(token), "Token 正常" if token else "Token 获取失败", {}

    return run_probe("dingtalk", "钉钉通讯录", configured=client.configured, probe=probe)


def run_probe(key, label, configured, probe):
    if not configured:
        return {
            "key": key,
            "label": label,
            "configured": False,
            "ok": False,
            "seconds": 0,
            "message": "未配置",
            "details": {},
        }

    start = time.time()
    try:
        ok, message, details = probe()
        return {
            "key": key,
            "label": label,
            "configured": True,
            "ok": bool(ok),
            "seconds": round(time.time() - start, 2),
            "message": message,
            "details": details,
        }
    except requests.RequestException:
        return {
            "key": key,
            "label": label,
            "configured": True,
            "ok": False,
            "seconds": round(time.time() - start, 2),
            "message": "连接失败或超时",
            "details": {},
        }
    except ValueError:
        return {
            "key": key,
            "label": label,
            "configured": True,
            "ok": False,
            "seconds": round(time.time() - start, 2),
            "message": "返回数据格式异常",
            "details": {},
        }
