import requests
from flask import current_app


class AccessControlClient:
    def __init__(self):
        config = current_app.config
        self.url = config.get("ACCESS_CONTROL_API_URL")
        self.username = config.get("ACCESS_CONTROL_API_USERNAME")
        self.password = config.get("ACCESS_CONTROL_API_PASSWORD")
        self.timeout = 30

    @property
    def configured(self):
        return bool(self.url and self.username and self.password)

    def query_devices(self, **params):
        if not self.configured:
            return {
                "status": "UNCONFIGURED",
                "msg": "联软准入 API 未配置",
                "rows": [],
            }
        payload = {
            "act": "queryDevByParams",
            "terminaltype": "1",
            "username": self.username,
            "password": self.password,
        }
        payload.update({key: value for key, value in params.items() if value is not None})
        response = requests.get(self.url, params=payload, timeout=self.timeout)
        response.raise_for_status()
        return response.json()


def normalize_client_row(row, real_name=None, os_info=None):
    os_info = os_info or {}
    return {
        "device_ip": row.get("strdevip", "N/A"),
        "username": row.get("strusername", "N/A"),
        "real_name": real_name,
        "is_online": row.get("status", 0) == 1,
        "device_name": os_info.get("device_name") or row.get("strdevname", "N/A"),
        "mac_address": os_info.get("mac_address") or row.get("strmac", "N/A"),
        "department": os_info.get("department") or row.get("strdeptname", "N/A"),
        "user_name": row.get("struserdes", "N/A"),
        "switch_name": os_info.get("switch_name") or row.get("strswitchname", "N/A"),
        "interface": os_info.get("interface") or row.get("strinterface", "N/A"),
        "location": os_info.get("location") or row.get("strlocation", "N/A"),
        "device_type": os_info.get("device_type") or row.get("strdevtype", "N/A"),
        "device_model": os_info.get("device_model") or row.get("strdevmodel", "N/A"),
        "vendor": os_info.get("vendor") or row.get("strvendor", "N/A"),
        "os": os_info.get("os") or row.get("stros", "N/A"),
        "os_version": os_info.get("os_version") or row.get("strosversion", row.get("strversion", "N/A")),
        "install_time": row.get("dtosinstalltime", "N/A"),
        "device_desc": row.get("strdevdesc", "N/A"),
        "uid_dev_record_id": row.get("uiddevrecordid", "N/A"),
        "str_dev_identity": row.get("strdevidentiy", "N/A"),
        "status_code": row.get("status", 0),
        "res2": row.get("strres2", "N/A"),
        "fvalue": row.get("fvalue", "N/A"),
    }
