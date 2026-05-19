from flask import Blueprint, request
from flask_login import current_user, login_required

from app.common.responses import failure, success
from app.common.validators import required_string
from app.modules.auth.service import authenticate_user, change_password, logout_current_user


auth_bp = Blueprint("auth_api", __name__, url_prefix="/api/auth")


@auth_bp.route("/login", methods=["POST"])
def login():
    data = request.get_json(silent=True) or {}
    try:
        username = required_string(data, "username", "用户名", max_length=50)
        password = required_string(data, "password", "密码", max_length=128)
    except ValueError as exc:
        return failure(str(exc), status=400)

    ok, message, user = authenticate_user(username, password, bool(data.get("remember_me")))
    if not ok:
        return failure(message, code=401, status=401)

    return success({
        "user": user.to_dict(),
        "redirect_url": "/",
    }, message=message)


@auth_bp.route("/logout", methods=["POST"])
@login_required
def logout():
    logout_current_user()
    return success({"redirect_url": "/login"}, message="登出成功")


@auth_bp.route("/profile", methods=["GET"])
def profile():
    if not current_user.is_authenticated:
        return failure("未授权访问，请先登录", code=401, status=401)
    return success(current_user.to_dict())


@auth_bp.route("/change-password", methods=["POST"])
@login_required
def change_current_password():
    data = request.get_json(silent=True) or {}
    try:
        old_password = required_string(data, "old_password", "当前密码", max_length=128)
        new_password = required_string(data, "new_password", "新密码", min_length=6, max_length=128)
    except ValueError as exc:
        return failure(str(exc), status=400)

    ok, message = change_password(current_user, old_password, new_password)
    if not ok:
        return failure(message, status=400)
    return success(message=message)
