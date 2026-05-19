import secrets
from datetime import timedelta

from flask import request, session
from flask_login import login_user, logout_user

from app.extensions import db
from app.models.base import now_local
from app.models.user import User, UserSession


def authenticate_user(username, password, remember_me=False):
    user = User.query.filter_by(username=username).first()
    if not user:
        return False, "用户名或密码错误", None

    if user.is_locked():
        return False, "账户已被锁定，请稍后再试", None

    if not user.is_active:
        return False, "账户未激活，请联系管理员", None

    if not user.check_password(password):
        user.record_login_failure()
        db.session.commit()
        return False, "用户名或密码错误", None

    user.record_login_success()
    session_id = create_session_record(user.id)
    db.session.commit()

    session["session_id"] = session_id
    login_user(user, remember=remember_me)
    return True, "登录成功", user


def create_session_record(user_id):
    session_id = secrets.token_urlsafe(32)
    record = UserSession(
        id=session_id,
        user_id=user_id,
        expires_at=now_local() + timedelta(hours=1),
        ip_address=request.remote_addr,
        user_agent=request.headers.get("User-Agent"),
        is_active=True,
    )
    db.session.add(record)
    return session_id


def logout_current_user():
    session_id = session.get("session_id")
    if session_id:
        record = UserSession.query.get(session_id)
        if record:
            record.is_active = False
            db.session.commit()

    session.clear()
    logout_user()


def change_password(user, old_password, new_password):
    if not user.check_password(old_password):
        return False, "当前密码错误"
    user.set_password(new_password)
    user.updated_at = now_local()
    db.session.commit()
    return True, "密码修改成功"
