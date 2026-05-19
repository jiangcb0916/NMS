from werkzeug.exceptions import HTTPException

from app.common.responses import failure


def register_error_handlers(app):
    @app.errorhandler(HTTPException)
    def handle_http_error(error):
        if error.code == 404:
            return failure("接口不存在" if _is_api_path() else "页面不存在", code=404, status=404)
        if error.code == 405:
            return failure("请求方法不被允许", code=405, status=405)
        return failure(error.description or "请求失败", code=error.code, status=error.code)

    @app.errorhandler(Exception)
    def handle_unexpected_error(error):
        app.logger.exception("未处理异常: %s", error)
        return failure("服务器内部错误", code=500, status=500)


def _is_api_path():
    from flask import request

    return request.path.startswith("/api/")
