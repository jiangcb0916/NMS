from flask import Blueprint, request
from flask_login import current_user, login_required

from app.common.responses import created, failure, success
from app.common.validators import optional_string, required_string
from app.extensions import db
from app.models.base import now_local
from app.models.user import User
from app.modules.auth.decorators import require_admin
from app.modules.auth.service import authenticate_user, change_password, logout_current_user


user_bp = Blueprint("user_api", __name__, url_prefix="/api/user")


@user_bp.route("/login", methods=["POST"])
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


@user_bp.route("/logout", methods=["POST"])
@login_required
def logout():
    logout_current_user()
    return success({"redirect_url": "/login"}, message="登出成功")


@user_bp.route("/profile", methods=["GET"])
def profile():
    if not current_user.is_authenticated:
        return failure("未授权访问，请先登录", code=401, status=401)
    return success(current_user.to_dict())


@user_bp.route("/change-password", methods=["POST"])
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


@user_bp.route("/list", methods=["GET"])
@login_required
@require_admin
def list_users():
    users = User.query.order_by(User.created_at.desc()).all()
    payload = [user.to_dict() for user in users]
    return success({
        "users": payload,
        "total": len(payload),
    })


@user_bp.route("/create", methods=["POST"])
@login_required
@require_admin
def create_user():
    data = request.get_json(silent=True) or {}
    try:
        username = required_string(data, "username", "用户名", min_length=3, max_length=50)
        password = required_string(data, "password", "密码", min_length=6, max_length=128)
        full_name = optional_string(data, "full_name", max_length=100)
        email = optional_string(data, "email", max_length=100)
        role = data.get("role") or "user"
    except ValueError as exc:
        return failure(str(exc), status=400)

    if role not in {"user", "operator", "admin"}:
        return failure("角色只能是 user、operator 或 admin", status=400)

    if User.query.filter_by(username=username).first():
        return failure("用户名已存在", status=400)
    if email and User.query.filter_by(email=email).first():
        return failure("邮箱已存在", status=400)

    user = User(username=username, email=email, full_name=full_name, role=role)
    if "is_active" in data:
        user.is_active = bool(data["is_active"])
    user.set_password(password)
    db.session.add(user)
    db.session.commit()
    return created(user.to_dict(), message="用户创建成功")


@user_bp.route("/<int:user_id>", methods=["GET"])
@login_required
def get_user(user_id):
    if current_user.id != user_id and not current_user.is_superuser and current_user.role != "admin":
        return failure("权限不足", code=403, status=403)

    user = User.query.get(user_id)
    if not user:
        return failure("用户不存在", code=404, status=404)
    return success(user.to_dict())


@user_bp.route("/<int:user_id>", methods=["PUT"])
@login_required
def update_user(user_id):
    if current_user.id != user_id and not current_user.is_superuser and current_user.role != "admin":
        return failure("权限不足", code=403, status=403)

    user = User.query.get(user_id)
    if not user:
        return failure("用户不存在", code=404, status=404)

    data = request.get_json(silent=True) or {}
    email = optional_string(data, "email", max_length=100)
    full_name = optional_string(data, "full_name", max_length=100)

    if email and email != user.email and User.query.filter_by(email=email).first():
        return failure("邮箱已存在", status=400)

    user.email = email
    user.full_name = full_name

    if current_user.is_superuser or current_user.role == "admin":
        role = data.get("role")
        if role:
            if role not in {"user", "operator", "admin"}:
                return failure("角色只能是 user、operator 或 admin", status=400)
            user.role = role
        if "is_active" in data:
            user.is_active = bool(data["is_active"])

    user.updated_at = now_local()
    db.session.commit()
    return success(user.to_dict(), message="用户更新成功")


@user_bp.route("/<int:user_id>", methods=["DELETE"])
@login_required
@require_admin
def delete_user(user_id):
    user = User.query.get(user_id)
    if not user:
        return failure("用户不存在", code=404, status=404)
    if user.id == current_user.id:
        return failure("不能删除当前登录用户", status=400)
    if not user.can_delete():
        return failure("超级管理员用户不能删除", status=400)

    db.session.delete(user)
    db.session.commit()
    return success(message="用户删除成功")


@user_bp.route("/<int:user_id>/reset-password", methods=["POST"])
@login_required
@require_admin
def reset_user_password(user_id):
    data = request.get_json(silent=True) or {}
    try:
        new_password = required_string(data, "new_password", "新密码", min_length=6, max_length=128)
    except ValueError as exc:
        return failure(str(exc), status=400)

    user = User.query.get(user_id)
    if not user:
        return failure("用户不存在", code=404, status=404)

    user.set_password(new_password)
    user.failed_login_count = 0
    user.locked_until = None
    user.updated_at = now_local()
    db.session.commit()
    return success(message="密码重置成功")


@user_bp.route("/<int:user_id>/lock", methods=["POST"])
@login_required
@require_admin
def lock_user(user_id):
    data = request.get_json(silent=True) or {}
    minutes = data.get("minutes", 30)
    try:
        minutes = int(minutes)
    except (TypeError, ValueError):
        return failure("锁定时间必须是整数分钟", status=400)
    if minutes <= 0:
        return failure("锁定时间必须大于0分钟", status=400)

    user = User.query.get(user_id)
    if not user:
        return failure("用户不存在", code=404, status=404)
    if user.id == current_user.id:
        return failure("不能锁定自己的账户", status=400)
    if user.is_superuser:
        return failure("不能锁定超级管理员账户", status=400)

    user.lock_user(minutes)
    db.session.commit()
    return success(user.to_dict(), message=f"用户已锁定 {minutes} 分钟")


@user_bp.route("/<int:user_id>/unlock", methods=["POST"])
@login_required
@require_admin
def unlock_user(user_id):
    user = User.query.get(user_id)
    if not user:
        return failure("用户不存在", code=404, status=404)

    user.unlock_user()
    db.session.commit()
    return success(user.to_dict(), message="用户已解锁")


@user_bp.route("/stats", methods=["GET"])
@login_required
@require_admin
def user_stats():
    total = User.query.count()
    active = User.query.filter_by(is_active=True).count()
    admins = User.query.filter(User.role == "admin").count()
    super_users = User.query.filter_by(is_superuser=True).count()
    recent_logins = User.query.filter(User.last_login.isnot(None)).order_by(User.last_login.desc()).limit(5).all()
    return success({
        "total": total,
        "active": active,
        "disabled": total - active,
        "admins": admins,
        "total_users": total,
        "admin_users": admins,
        "super_users": super_users,
        "recent_logins": [
            {
                "username": user.username,
                "last_login": user.to_dict()["last_login"],
            }
            for user in recent_logins
        ],
    })
