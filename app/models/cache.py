from app.extensions import db
from app.models.base import format_datetime, now_local


class UserNameCache(db.Model):
    __tablename__ = "user_name_cache"

    mobile = db.Column(db.String(20), primary_key=True)
    real_name = db.Column(db.String(100), nullable=False)
    created_at = db.Column(db.DateTime, default=now_local, nullable=False)
    expires_at = db.Column(db.DateTime, nullable=False)
    last_updated = db.Column(db.DateTime, default=now_local, onupdate=now_local, nullable=False)

    def is_expired(self):
        return now_local() > self.expires_at

    def to_dict(self):
        return {
            "mobile": self.mobile,
            "real_name": self.real_name,
            "created_at": format_datetime(self.created_at),
            "expires_at": format_datetime(self.expires_at),
            "last_updated": format_datetime(self.last_updated),
        }


class DeviceOsCache(db.Model):
    __tablename__ = "device_os_cache"

    device_ip = db.Column(db.String(45), primary_key=True)
    os = db.Column(db.String(128), nullable=True)
    os_version = db.Column(db.String(128), nullable=True)
    device_type = db.Column(db.String(128), nullable=True)
    device_model = db.Column(db.String(128), nullable=True)
    vendor = db.Column(db.String(128), nullable=True)
    device_name = db.Column(db.String(256), nullable=True)
    mac_address = db.Column(db.String(28), nullable=True)
    department = db.Column(db.String(128), nullable=True)
    switch_name = db.Column(db.String(128), nullable=True)
    interface = db.Column(db.String(128), nullable=True)
    location = db.Column(db.String(128), nullable=True)
    created_at = db.Column(db.DateTime, default=now_local, nullable=False)
    expires_at = db.Column(db.DateTime, nullable=False)
    last_updated = db.Column(db.DateTime, default=now_local, onupdate=now_local, nullable=False)
    cache_hit_count = db.Column(db.Integer, default=0, nullable=False)

    def is_expired(self):
        return now_local() > self.expires_at

    def to_dict(self):
        return {
            "device_ip": self.device_ip,
            "os": self.os,
            "os_version": self.os_version,
            "device_type": self.device_type,
            "device_model": self.device_model,
            "vendor": self.vendor,
            "device_name": self.device_name,
            "mac_address": self.mac_address,
            "department": self.department,
            "switch_name": self.switch_name,
            "interface": self.interface,
            "location": self.location,
            "created_at": format_datetime(self.created_at),
            "expires_at": format_datetime(self.expires_at),
            "last_updated": format_datetime(self.last_updated),
            "cache_hit_count": self.cache_hit_count,
        }
