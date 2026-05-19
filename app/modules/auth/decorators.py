from functools import wraps

from flask_login import current_user

from app.common.responses import failure


def require_admin(view):
    @wraps(view)
    def wrapped(*args, **kwargs):
        if not current_user.is_authenticated:
            return failure("未授权访问，请先登录", code=401, status=401)
        if not current_user.is_superuser and current_user.role != "admin":
            return failure("权限不足，需要管理员权限", code=403, status=403)
        return view(*args, **kwargs)

    return wrapped
