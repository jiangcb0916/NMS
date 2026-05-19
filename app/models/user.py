from flask_login import UserMixin
from werkzeug.security import check_password_hash, generate_password_hash

from app.extensions import db
from app.models.base import format_datetime, now_local


class User(UserMixin, db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    username = db.Column(db.String(50), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    email = db.Column(db.String(100), unique=True, nullable=True)
    full_name = db.Column(db.String(100), nullable=True)
    role = db.Column(db.String(20), nullable=False, default="user")
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    is_superuser = db.Column(db.Boolean, default=False, nullable=False)
    created_at = db.Column(db.DateTime, default=now_local, nullable=False)
    updated_at = db.Column(db.DateTime, default=now_local, onupdate=now_local, nullable=False)
    last_login = db.Column(db.DateTime, nullable=True)
    login_count = db.Column(db.Integer, default=0, nullable=False)
    failed_login_count = db.Column(db.Integer, default=0, nullable=False)
    locked_until = db.Column(db.DateTime, nullable=True)

    def set_password(self, password):
        self.password_hash = generate_password_hash(password, method="pbkdf2:sha256", salt_length=16)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    def get_id(self):
        return str(self.id)

    def is_locked(self):
        return self.locked_until is not None and self.locked_until > now_local()

    def lock_user(self, minutes=30):
        from datetime import timedelta

        self.locked_until = now_local() + timedelta(minutes=minutes)
        self.updated_at = now_local()

    def unlock_user(self):
        self.locked_until = None
        self.failed_login_count = 0
        self.updated_at = now_local()

    def record_login_success(self):
        self.last_login = now_local()
        self.login_count += 1
        self.failed_login_count = 0
        self.locked_until = None
        self.updated_at = now_local()

    def record_login_failure(self, max_failures=5, lock_minutes=30):
        self.failed_login_count += 1
        if self.failed_login_count >= max_failures:
            from datetime import timedelta

            self.locked_until = now_local() + timedelta(minutes=lock_minutes)
        self.updated_at = now_local()

    def can_delete(self):
        return not self.is_superuser

    def to_dict(self):
        return {
            "id": self.id,
            "username": self.username,
            "email": self.email,
            "full_name": self.full_name,
            "role": self.role,
            "is_active": self.is_active,
            "is_superuser": self.is_superuser,
            "created_at": format_datetime(self.created_at),
            "updated_at": format_datetime(self.updated_at),
            "last_login": format_datetime(self.last_login),
            "login_count": self.login_count,
            "failed_login_count": self.failed_login_count,
            "locked_until": format_datetime(self.locked_until),
            "is_locked": self.is_locked(),
            "can_delete": self.can_delete(),
        }


class UserSession(db.Model):
    __tablename__ = "user_sessions"

    id = db.Column(db.String(128), primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    created_at = db.Column(db.DateTime, default=now_local, nullable=False)
    expires_at = db.Column(db.DateTime, nullable=False)
    ip_address = db.Column(db.String(45), nullable=True)
    user_agent = db.Column(db.Text, nullable=True)
    is_active = db.Column(db.Boolean, default=True, nullable=False)

    user = db.relationship("User", backref=db.backref("sessions", lazy=True))

    def is_expired(self):
        return now_local() > self.expires_at
