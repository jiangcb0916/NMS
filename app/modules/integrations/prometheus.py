import re

import requests
from flask import current_app


class PrometheusClient:
    def __init__(self):
        config = current_app.config
        self.query_url = config.get("PROMETHEUS_QUERY_URL")
        self.metrics_url = config.get("PROMETHEUS_METRICS_URL")
        self.timeout = 10

    @property
    def query_configured(self):
        return bool(self.query_url)

    @property
    def metrics_configured(self):
        return bool(self.metrics_url)

    def query(self, expression):
        if not self.query_configured:
            return []
        response = requests.get(self.query_url, params={"query": expression}, timeout=self.timeout)
        response.raise_for_status()
        payload = response.json()
        if payload.get("status") != "success":
            return []
        return payload.get("data", {}).get("result", [])

    def metrics_text(self):
        if not self.metrics_configured:
            return ""
        response = requests.get(self.metrics_url, timeout=self.timeout)
        response.raise_for_status()
        return response.text


def metric_value(result, default=0):
    try:
        return float(result[0]["value"][1]) if result else default
    except (KeyError, IndexError, TypeError, ValueError):
        return default


def hex_to_string(value, default="N/A"):
    if not value or value == "N/A":
        return default
    value = value.replace("0x", "")
    try:
        return bytes.fromhex(value).decode("utf-8", errors="ignore") or default
    except ValueError:
        return default


def hex_to_ip(value):
    text = hex_to_string(value)
    if text.count(".") == 3:
        parts = text.split(".")
        if all(part.isdigit() and 0 <= int(part) <= 255 for part in parts):
            return text
    return "N/A"


def hex_to_mac(value):
    if not value or value == "N/A":
        return "N/A"
    text = value.replace("0x", "")
    try:
        decoded = bytes.fromhex(text).decode("utf-8", errors="ignore")
        if decoded:
            return decoded
    except ValueError:
        pass
    if len(text) >= 12:
        return "-".join(text[i:i + 2].upper() for i in range(0, 12, 2))
    return "N/A"


def parse_user_names_metrics(text):
    user_names = {}
    for line in text.splitlines():
        if not line.startswith("sfUserName{") or line.startswith("#"):
            continue
        phone_match = re.search(r'sfUserPhone="([^"]*)"', line)
        name_match = re.search(r'sfUserName="([^"]*)"', line)
        if phone_match and name_match:
            phone = phone_match.group(1)
            name = name_match.group(1)
            if phone and name and phone != name:
                user_names[phone] = name
    return user_names
