from datetime import datetime, timedelta, timezone


LOCAL_TZ = timezone(timedelta(hours=8))


def now_local():
    return datetime.now(LOCAL_TZ).replace(tzinfo=None)


def format_datetime(value):
    if value is None:
        return None
    return value.strftime("%Y-%m-%d %H:%M:%S")
