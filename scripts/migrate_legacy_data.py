#!/usr/bin/env python3
import os
import sqlite3
import sys
from datetime import datetime
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parents[1]
DEFAULT_LEGACY_DB = ROOT_DIR.parent / "sangfor" / "instance" / "network_management.db"
sys.path.insert(0, str(ROOT_DIR))

from app import create_app
from app.extensions import db
from app.models.cache import DeviceOsCache, UserNameCache
from app.models.device import Device
from app.models.user import User


def parse_datetime(value):
    if not value:
        return None
    if isinstance(value, datetime):
        return value.replace(tzinfo=None)
    text = str(value).replace("T", " ").split("+", 1)[0].split(".", 1)[0]
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d"):
        try:
            return datetime.strptime(text, fmt)
        except ValueError:
            pass
    return None


def bool_value(value):
    if isinstance(value, bool):
        return value
    return str(value).strip().lower() in {"1", "true", "yes", "on"}


def fetch_rows(connection, table_name):
    try:
        cursor = connection.execute(f"SELECT * FROM {table_name}")
    except sqlite3.OperationalError:
        return []
    return [dict(row) for row in cursor.fetchall()]


def migrate_users(rows):
    created = 0
    skipped = 0
    for row in rows:
        if User.query.filter_by(username=row["username"]).first():
            skipped += 1
            continue

        email = row.get("email")
        if email and User.query.filter_by(email=email).first():
            email = None

        user = User(
            username=row["username"],
            email=email,
            full_name=row.get("full_name"),
            role=row.get("role") or "user",
            is_active=bool_value(row.get("is_active", True)),
            is_superuser=bool_value(row.get("is_superuser", False)),
        )
        user.password_hash = row["password_hash"]
        user.created_at = parse_datetime(row.get("created_at")) or user.created_at
        user.updated_at = parse_datetime(row.get("updated_at")) or user.updated_at
        user.last_login = parse_datetime(row.get("last_login"))
        user.login_count = int(row.get("login_count") or 0)
        user.failed_login_count = int(row.get("failed_login_count") or 0)
        user.locked_until = parse_datetime(row.get("locked_until"))
        db.session.add(user)
        created += 1
    return created, skipped


def migrate_devices(rows):
    created = 0
    updated = 0
    for row in rows:
        device = Device.query.filter_by(ip_address=row["ip_address"]).first()
        if not device:
            device = Device(ip_address=row["ip_address"], username=row["username"])
            db.session.add(device)
            created += 1
        else:
            updated += 1

        device.username = row.get("username") or device.username
        device.mac_address = row.get("mac_address")
        device.details = row.get("details")
        device.category = row.get("category") or "未分类"
        device.is_online = bool_value(row.get("is_online", False))
        device.last_check_time = parse_datetime(row.get("last_check_time"))
        device.created_at = parse_datetime(row.get("created_at")) or device.created_at
        device.updated_at = parse_datetime(row.get("updated_at")) or device.updated_at
    return created, updated


def migrate_name_cache(rows):
    return upsert_cache_rows(UserNameCache, "mobile", rows, [
        "real_name",
        "created_at",
        "expires_at",
        "last_updated",
    ])


def migrate_os_cache(rows):
    return upsert_cache_rows(DeviceOsCache, "device_ip", rows, [
        "os",
        "os_version",
        "device_type",
        "device_model",
        "vendor",
        "device_name",
        "mac_address",
        "department",
        "switch_name",
        "interface",
        "location",
        "created_at",
        "expires_at",
        "last_updated",
        "cache_hit_count",
    ])


def upsert_cache_rows(model, key_name, rows, fields):
    created = 0
    updated = 0
    for row in rows:
        key = row.get(key_name)
        if not key:
            continue
        item = model.query.get(key)
        if not item:
            item = model(**{key_name: key})
            db.session.add(item)
            created += 1
        else:
            updated += 1
        for field in fields:
            if field not in row:
                continue
            value = row[field]
            if field in {"created_at", "expires_at", "last_updated"}:
                value = parse_datetime(value)
            if field == "cache_hit_count":
                value = int(value or 0)
            setattr(item, field, value)
    return created, updated


def main():
    legacy_db = Path(os.environ.get("LEGACY_DATABASE_PATH", DEFAULT_LEGACY_DB))
    if not legacy_db.exists():
        raise SystemExit(f"旧数据库不存在: {legacy_db}")

    app = create_app()
    with sqlite3.connect(str(legacy_db)) as connection:
        connection.row_factory = sqlite3.Row
        rows = {
            "users": fetch_rows(connection, "users"),
            "device_list": fetch_rows(connection, "device_list"),
            "user_name_cache": fetch_rows(connection, "user_name_cache"),
            "device_os_cache": fetch_rows(connection, "device_os_cache"),
        }

    with app.app_context():
        db.create_all()
        user_created, user_skipped = migrate_users(rows["users"])
        device_created, device_updated = migrate_devices(rows["device_list"])
        name_cache_created, name_cache_updated = migrate_name_cache(rows["user_name_cache"])
        os_cache_created, os_cache_updated = migrate_os_cache(rows["device_os_cache"])
        db.session.commit()

    print("legacy data migration completed")
    print(f"users: created={user_created}, skipped={user_skipped}")
    print(f"devices: created={device_created}, updated={device_updated}")
    print(f"user_name_cache: created={name_cache_created}, updated={name_cache_updated}")
    print(f"device_os_cache: created={os_cache_created}, updated={os_cache_updated}")


if __name__ == "__main__":
    main()
