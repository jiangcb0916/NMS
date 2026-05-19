import hashlib
import uuid

import requests
from flask import current_app


class SangforACClient:
    def __init__(self, host=None, port=None, shared_secret=None, timeout=None):
        config = current_app.config
        self.host = host or config.get("SANGFOR_AC_HOST")
        self.port = port or config.get("SANGFOR_AC_PORT")
        self.shared_secret = shared_secret or config.get("SANGFOR_AC_SHARED_SECRET")
        self.timeout = timeout or config.get("SANGFOR_AC_TIMEOUT", 10)

    @property
    def configured(self):
        return bool(self.host and self.port and self.shared_secret)

    @property
    def base_url(self):
        return f"http://{self.host}:{self.port}"

    def get_version(self):
        return self.request("GET", "/v1/status/version")

    def get_online_users(self):
        return self.request("GET", "/v1/status/online-user")

    def get_session_num(self):
        return self.request("GET", "/v1/status/session-num")

    def get_cpu_usage(self):
        return self.request("GET", "/v1/status/cpu-usage")

    def get_memory_usage(self):
        return self.request("GET", "/v1/status/mem-usage")

    def get_disk_usage(self):
        return self.request("GET", "/v1/status/disk-usage")

    def get_system_time(self):
        return self.request("GET", "/v1/status/sys-time")

    def get_throughput(self, unit="bytes", interface=None):
        payload = {
            "filter": {
                "unit": unit,
            }
        }
        if interface:
            payload["filter"]["interface"] = interface
        return self.request("POST", "/v1/status/throughput?_method=GET", data=payload)

    def get_user_rank(self, top=1000, line="0", groups=None, users=None, ips=None):
        filter_data = {
            "top": top,
            "line": line,
        }
        if groups:
            filter_data["groups"] = groups
        elif users:
            filter_data["users"] = users
        elif ips:
            filter_data["ips"] = ips

        return self.request("POST", "/v1/status/user-rank?_method=GET", data={"filter": filter_data})

    def get_app_rank(self, top=60, groups=None, line="0"):
        filter_data = {
            "top": top,
            "line": line,
        }
        if groups:
            filter_data["groups"] = groups

        return self.request("POST", "/v1/status/app-rank?_method=GET", data={"filter": filter_data})

    def get_netpolicies(self):
        return self.request("GET", "/v1/policy/netpolicy")

    def request(self, method, endpoint, data=None, params=None):
        if not self.configured:
            return {
                "code": 503,
                "message": "深信服 AC 接口未配置",
                "data": None,
            }

        auth = self._auth_params()
        headers = {
            "Content-Type": "application/json",
            "Accept-Language": "zh-CN",
        }
        url = f"{self.base_url}{endpoint}"

        try:
            if method.upper() == "GET":
                merged_params = dict(params or {})
                merged_params.update(auth)
                response = requests.get(url, params=merged_params, headers=headers, timeout=self.timeout)
            else:
                payload = dict(data or {})
                payload.update(auth)
                response = requests.post(url, json=payload, headers=headers, timeout=self.timeout)

            response.raise_for_status()
            return response.json()
        except requests.RequestException as exc:
            return {
                "code": 1,
                "message": f"请求深信服 AC 失败: {exc}",
                "data": None,
            }
        except ValueError:
            return {
                "code": 1,
                "message": "深信服 AC 返回非 JSON 数据",
                "data": None,
            }

    def _auth_params(self):
        random_value = str(uuid.uuid4())
        digest = hashlib.md5((self.shared_secret + random_value).encode("utf-8")).hexdigest()
        return {
            "random": random_value,
            "md5": digest,
        }
