import platform
import subprocess
import threading

from app.extensions import db
from app.models.base import now_local
from app.models.device import Device


_monitor_thread = None
_monitor_stop_event = threading.Event()
_monitor_lock = threading.Lock()


def ping_device(ip_address, timeout_seconds=1):
    system = platform.system().lower()
    if system == "darwin":
        command = ["ping", "-c", "1", "-W", str(timeout_seconds * 1000), ip_address]
    else:
        command = ["ping", "-c", "1", "-W", str(timeout_seconds), ip_address]

    try:
        result = subprocess.run(command, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=timeout_seconds + 1)
        return result.returncode == 0
    except (OSError, subprocess.TimeoutExpired):
        return False


def update_device_status(device, timeout_seconds=1):
    device.is_online = ping_device(device.ip_address, timeout_seconds=timeout_seconds)
    device.last_check_time = now_local()
    return device.is_online


def refresh_all_device_status(timeout_seconds=1):
    devices = Device.query.order_by(Device.created_at.desc()).all()
    online = 0

    for device in devices:
        if update_device_status(device, timeout_seconds=timeout_seconds):
            online += 1

    db.session.commit()
    return {
        "checked_devices": len(devices),
        "online_devices": online,
        "offline_devices": len(devices) - online,
    }


def start_status_monitoring(app, interval_seconds=300, timeout_seconds=1):
    global _monitor_thread

    with _monitor_lock:
        if _monitor_thread and _monitor_thread.is_alive():
            return monitoring_snapshot(interval_seconds)

        _monitor_stop_event.clear()
        _monitor_thread = threading.Thread(
            target=_monitor_loop,
            args=(app, interval_seconds, timeout_seconds),
            daemon=True,
            name="device-status-monitor",
        )
        _monitor_thread.start()
        return monitoring_snapshot(interval_seconds)


def stop_status_monitoring(interval_seconds=300):
    _monitor_stop_event.set()
    return monitoring_snapshot(interval_seconds)


def monitoring_snapshot(interval_seconds=300):
    thread_alive = bool(_monitor_thread and _monitor_thread.is_alive())
    return {
        "monitoring": thread_alive and not _monitor_stop_event.is_set(),
        "check_interval": interval_seconds,
        "thread_alive": thread_alive,
    }


def _monitor_loop(app, interval_seconds, timeout_seconds):
    while not _monitor_stop_event.is_set():
        with app.app_context():
            refresh_all_device_status(timeout_seconds=timeout_seconds)

        _monitor_stop_event.wait(interval_seconds)
