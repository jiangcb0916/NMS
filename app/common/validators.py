import ipaddress
import re


def required_string(data, name, label=None, min_length=1, max_length=None):
    label = label or name
    value = data.get(name)
    if value is None or str(value).strip() == "":
        raise ValueError(f"{label}不能为空")

    value = str(value).strip()
    if len(value) < min_length:
        raise ValueError(f"{label}长度不能少于{min_length}个字符")
    if max_length and len(value) > max_length:
        raise ValueError(f"{label}长度不能超过{max_length}个字符")
    return value


def optional_string(data, name, max_length=None):
    value = data.get(name)
    if value is None:
        return None
    value = str(value).strip()
    if value == "":
        return None
    if max_length and len(value) > max_length:
        raise ValueError(f"{name}长度不能超过{max_length}个字符")
    return value


def validate_ip(value, label="IP地址"):
    try:
        return str(ipaddress.ip_address(value))
    except ValueError as exc:
        raise ValueError(f"{label}格式不正确") from exc


def validate_mac(value, label="MAC地址"):
    if value is None or value == "":
        return None
    value = str(value).strip()
    pattern = r"^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$"
    if not re.match(pattern, value):
        raise ValueError(f"{label}格式不正确，应为 XX:XX:XX:XX:XX:XX 或 XX-XX-XX-XX-XX-XX")
    return value.upper().replace("-", ":")
