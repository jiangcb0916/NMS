import os
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parents[1]
INSTANCE_PATH = ROOT_DIR / "instance"
ENV_FILE = ROOT_DIR / ".env"


def load_env_file(path):
    if not path.exists():
        return

    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue

        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        os.environ.setdefault(key, value)


load_env_file(ENV_FILE)


def env_bool(name, default=False):
    value = os.environ.get(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def env_int(name, default):
    value = os.environ.get(name)
    if value is None or value == "":
        return default
    return int(value)


class Config:
    VERSION = "v5.0.0-alpha"

    HOST = os.environ.get("HOST", "127.0.0.1")
    PORT = env_int("PORT", 5001)
    DEBUG = env_bool("DEBUG", False)
    SECRET_KEY = os.environ.get("SECRET_KEY", "dev-only-change-me")

    INSTANCE_DIR = str(INSTANCE_PATH)
    SESSION_TYPE = "filesystem"
    SESSION_PERMANENT = False
    SESSION_USE_SIGNER = True
    SESSION_KEY_PREFIX = "nms-next:"
    SESSION_FILE_DIR = os.environ.get("SESSION_FILE_DIR", str(INSTANCE_PATH / "flask_session"))

    SQLALCHEMY_DATABASE_URI = os.environ.get(
        "DATABASE_URL",
        f"sqlite:///{INSTANCE_PATH / 'network_management_next.db'}",
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = {
        "pool_pre_ping": True,
        "pool_recycle": 300,
    }

    SANGFOR_AC_HOST = os.environ.get("SANGFOR_AC_HOST")
    SANGFOR_AC_PORT = env_int("SANGFOR_AC_PORT", 9999)
    SANGFOR_AC_SHARED_SECRET = os.environ.get("SANGFOR_AC_SHARED_SECRET")
    SANGFOR_AC_TIMEOUT = env_int("SANGFOR_AC_TIMEOUT", 10)

    DINGTALK_APPKEY = os.environ.get("DINGTALK_APPKEY")
    DINGTALK_APPSECRET = os.environ.get("DINGTALK_APPSECRET")
    DINGTALK_TOKEN_TTL = env_int("DINGTALK_TOKEN_TTL", 7000)

    PROMETHEUS_QUERY_URL = os.environ.get("PROMETHEUS_QUERY_URL", "http://172.16.80.125:9090/api/v1/query")
    PROMETHEUS_METRICS_URL = os.environ.get("PROMETHEUS_METRICS_URL", "http://172.16.80.125:9191/metrics")
    PROMETHEUS_TARGETS_URL = os.environ.get("PROMETHEUS_TARGETS_URL", "http://172.16.80.125:9090/api/v1/targets")
    WIRELESS_INSTANCE = os.environ.get("WIRELESS_INSTANCE", "172.16.100.7")
    WIRELESS_JOB = os.environ.get("WIRELESS_JOB", "ND")
    WIRELESS_AUTH = os.environ.get("WIRELESS_AUTH", "nac")
    WIRELESS_MODULE = os.environ.get("WIRELESS_MODULE", "mgmt,private")
    SWITCH_PROMETHEUS_JOB = os.environ.get("SWITCH_PROMETHEUS_JOB", "sw")
    SWITCH_TARGET_GROUP = os.environ.get("SWITCH_TARGET_GROUP", "pool-sw")
    SWITCH_TRAFFIC_RATE_WINDOW = os.environ.get("SWITCH_TRAFFIC_RATE_WINDOW", "5m")
    SWITCH_PORT_EXCLUDE_PATTERNS = os.environ.get(
        "SWITCH_PORT_EXCLUDE_PATTERNS",
        r"^(InLoopBack|LoopBack|NULL|Console|MEth|Vlanif|Vlan-interface|Stack-Port|Aux|Tunnel)",
    )

    HUAWEI_SNMP_URL = os.environ.get("HUAWEI_SNMP_URL", "http://172.16.80.125:9116/snmp")
    HUAWEI_SNMP_AUTH = os.environ.get("HUAWEI_SNMP_AUTH", "secure_v3")
    HUAWEI_SNMP_MODULE = os.environ.get("HUAWEI_SNMP_MODULE", "hw_health")
    HUAWEI_FIREWALL_TARGET = os.environ.get("HUAWEI_FIREWALL_TARGET", "172.16.100.3")
    HUAWEI_PROMETHEUS_JOB = os.environ.get("HUAWEI_PROMETHEUS_JOB", "USG")
    HUAWEI_TOTAL_BANDWIDTH_MBPS = env_int("HUAWEI_TOTAL_BANDWIDTH_MBPS", 450)

    OSDWAN_API_BASE_URL = os.environ.get("OSDWAN_API_BASE_URL", "https://api.wanflow.com")
    OSDWAN_CONSOLE_ORIGIN = os.environ.get("OSDWAN_CONSOLE_ORIGIN", "https://console.wanflow.com")
    OSDWAN_TOKEN = os.environ.get("OSDWAN_TOKEN")
    OSDWAN_TIMEOUT = env_int("OSDWAN_TIMEOUT", 15)
    OSDWAN_ALL_STATS_PERIOD = os.environ.get("OSDWAN_ALL_STATS_PERIOD", "1day")
    OSDWAN_NODE_ID = os.environ.get("OSDWAN_NODE_ID", "2168")
    OSDWAN_NODE_NAME = os.environ.get("OSDWAN_NODE_NAME", "办公开发")
    OSDWAN_NODE_STATS_PERIOD = os.environ.get("OSDWAN_NODE_STATS_PERIOD", "6hours")
    OSDWAN_NODE_VIEW_TYPE = os.environ.get("OSDWAN_NODE_VIEW_TYPE", "total")

    ACCESS_CONTROL_API_URL = os.environ.get("ACCESS_CONTROL_API_URL")
    ACCESS_CONTROL_API_USERNAME = os.environ.get("ACCESS_CONTROL_API_USERNAME")
    ACCESS_CONTROL_API_PASSWORD = os.environ.get("ACCESS_CONTROL_API_PASSWORD")
    ACCESS_CONTROL_FILTER_DEPARTMENT = os.environ.get("ACCESS_CONTROL_FILTER_DEPARTMENT", "LDAP")

    DEVICE_STATUS_CHECK_INTERVAL = env_int("DEVICE_STATUS_CHECK_INTERVAL", 300)
    DEVICE_STATUS_PING_TIMEOUT = env_int("DEVICE_STATUS_PING_TIMEOUT", 1)

    @classmethod
    def validate_runtime(cls):
        if not cls.DEBUG and cls.SECRET_KEY == "dev-only-change-me":
            raise RuntimeError("生产环境必须通过 SECRET_KEY 环境变量设置随机密钥")
