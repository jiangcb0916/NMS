import json

from app.extensions import db
from app.models.base import format_datetime, now_local


class Event(db.Model):
    __tablename__ = "events"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    event_key = db.Column(db.String(180), unique=True, nullable=False, index=True)
    source = db.Column(db.String(80), nullable=False, index=True)
    severity = db.Column(db.String(20), nullable=False, default="warning", index=True)
    title = db.Column(db.String(160), nullable=False)
    message = db.Column(db.Text, nullable=True)
    status = db.Column(db.String(20), nullable=False, default="open", index=True)
    occurrence_count = db.Column(db.Integer, nullable=False, default=1)
    details = db.Column(db.Text, nullable=True)
    first_seen = db.Column(db.DateTime, default=now_local, nullable=False)
    last_seen = db.Column(db.DateTime, default=now_local, nullable=False, index=True)
    acknowledged_at = db.Column(db.DateTime, nullable=True)
    resolved_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=now_local, nullable=False)
    updated_at = db.Column(db.DateTime, default=now_local, onupdate=now_local, nullable=False)

    def details_dict(self):
        if not self.details:
            return {}
        try:
            payload = json.loads(self.details)
        except (TypeError, ValueError):
            return {}
        return payload if isinstance(payload, dict) else {}

    def to_dict(self):
        return {
            "id": self.id,
            "event_key": self.event_key,
            "source": self.source,
            "severity": self.severity,
            "title": self.title,
            "message": self.message or "",
            "status": self.status,
            "occurrence_count": self.occurrence_count,
            "details": self.details_dict(),
            "first_seen": format_datetime(self.first_seen),
            "last_seen": format_datetime(self.last_seen),
            "acknowledged_at": format_datetime(self.acknowledged_at),
            "resolved_at": format_datetime(self.resolved_at),
            "created_at": format_datetime(self.created_at),
            "updated_at": format_datetime(self.updated_at),
        }
