from flask import Blueprint, jsonify, request
from flask_login import login_required

from app.common.responses import failure, success
from app.modules.auth.decorators import require_admin
from app.modules.sangfor_ac.client import SangforACClient


sangfor_ac_bp = Blueprint("sangfor_ac_api", __name__, url_prefix="/api/sangfor")
legacy_status_bp = Blueprint("legacy_status_api", __name__)


@sangfor_ac_bp.route("/status/version", methods=["GET"])
@login_required
def version():
    result = SangforACClient().get_version()
    return success(result)


@legacy_status_bp.route("/api/status/online-user", methods=["GET"])
@login_required
def legacy_online_user():
    return jsonify(SangforACClient().get_online_users())


@legacy_status_bp.route("/api/status/online-user-list", methods=["GET"])
@login_required
def legacy_online_user_list():
    return jsonify(SangforACClient().get_user_rank(top=1000, line="0"))


@legacy_status_bp.route("/api/status/session-num", methods=["GET"])
@login_required
def legacy_session_num():
    return jsonify(SangforACClient().get_session_num())


@legacy_status_bp.route("/api/status/cpu-usage", methods=["GET"])
@login_required
def legacy_cpu_usage():
    return jsonify(SangforACClient().get_cpu_usage())


@legacy_status_bp.route("/api/status/memory-usage", methods=["GET"])
@login_required
def legacy_memory_usage():
    return jsonify(SangforACClient().get_memory_usage())


@legacy_status_bp.route("/api/status/disk-usage", methods=["GET"])
@login_required
def legacy_disk_usage():
    return jsonify(SangforACClient().get_disk_usage())


@legacy_status_bp.route("/api/status/system-time", methods=["GET"])
@login_required
def legacy_system_time():
    return jsonify(SangforACClient().get_system_time())


@legacy_status_bp.route("/api/status/throughput", methods=["POST"])
@login_required
def legacy_throughput():
    data = request.get_json(silent=True) or {}
    return jsonify(SangforACClient().get_throughput(
        unit=data.get("unit", "bytes"),
        interface=data.get("interface"),
    ))


@legacy_status_bp.route("/api/status/user-rank", methods=["POST"])
@login_required
def legacy_user_rank():
    data = request.get_json(silent=True) or {}
    filter_data = data.get("filter", {})
    return jsonify(SangforACClient().get_user_rank(
        top=filter_data.get("top", 1000),
        line=filter_data.get("line", "0"),
        groups=filter_data.get("groups"),
        users=filter_data.get("users"),
        ips=filter_data.get("ips"),
    ))


@legacy_status_bp.route("/api/status/app-rank", methods=["POST"])
@login_required
def legacy_app_rank():
    data = request.get_json(silent=True) or {}
    filter_data = data.get("filter", {})
    return jsonify(SangforACClient().get_app_rank(
        top=filter_data.get("top", 60),
        groups=filter_data.get("groups"),
        line=filter_data.get("line", "0"),
    ))


@legacy_status_bp.route("/api/policy/netpolicy", methods=["GET"])
@login_required
def legacy_netpolicy():
    return jsonify(SangforACClient().get_netpolicies())


@legacy_status_bp.route("/api/user/kick-offline", methods=["POST"])
@login_required
@require_admin
def legacy_kick_user_offline():
    return failure("强制用户下线功能暂不支持，请使用设备管理界面操作", status=501)


@legacy_status_bp.route("/api/statistics/behavior", methods=["GET"])
@login_required
def legacy_behavior():
    return success(None, message="Success")


@legacy_status_bp.route("/api/prometheus/metrics", methods=["GET"])
@login_required
def legacy_prometheus_metrics():
    return failure("此接口已禁用，请使用其他 API 获取数据", code=404, status=404)
