from app.extensions import db
from app.models.base import format_datetime, now_local


class Device(db.Model):
    __tablename__ = "devices"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    username = db.Column(db.String(100), nullable=False)
    ip_address = db.Column(db.String(45), nullable=False, unique=True, index=True)
    mac_address = db.Column(db.String(28), nullable=True)
    details = db.Column(db.Text, nullable=True)
    category = db.Column(db.String(50), default="未分类", nullable=False)
    is_online = db.Column(db.Boolean, default=False, nullable=False)
    last_check_time = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=now_local, nullable=False)
    updated_at = db.Column(db.DateTime, default=now_local, onupdate=now_local, nullable=False)

    def to_dict(self):
        return {
            "id": self.id,
            "username": self.username,
            "ip_address": self.ip_address,
            "mac_address": self.mac_address,
            "details": self.details,
            "category": self.category,
            "is_online": self.is_online,
            "last_check_time": format_datetime(self.last_check_time),
            "created_at": format_datetime(self.created_at),
            "updated_at": format_datetime(self.updated_at),
        }
