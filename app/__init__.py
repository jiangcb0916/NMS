from pathlib import Path

from flask import Flask

from app.common.errors import register_error_handlers
from app.config import Config
from app.extensions import db, login_manager, server_session
from app.models import User


ROOT_DIR = Path(__file__).resolve().parents[1]


def create_app(config_object=Config):
    app = Flask(
        __name__,
        template_folder=str(ROOT_DIR / "templates"),
        static_folder=str(ROOT_DIR / "static"),
    )
    app.config.from_object(config_object)

    Path(app.config["INSTANCE_DIR"]).mkdir(parents=True, exist_ok=True)
    Path(app.config["SESSION_FILE_DIR"]).mkdir(parents=True, exist_ok=True)

    db.init_app(app)
    login_manager.init_app(app)
    server_session.init_app(app)

    login_manager.login_view = "web.login_page"
    login_manager.login_message = "请先登录"
    login_manager.session_protection = "strong"

    @login_manager.user_loader
    def load_user(user_id):
        try:
            return User.query.get(int(user_id))
        except (TypeError, ValueError):
            return None

    register_error_handlers(app)
    register_blueprints(app)

    return app


def register_blueprints(app):
    from app.modules.auth.routes import auth_bp
    from app.modules.access_control.routes import access_control_bp
    from app.modules.cache.routes import cache_bp
    from app.modules.dashboard.routes import dashboard_bp
    from app.modules.devices.routes import device_bp
    from app.modules.firewall.routes import firewall_bp
    from app.modules.integrations.status_routes import integration_status_bp
    from app.modules.sangfor_ac.routes import legacy_status_bp, sangfor_ac_bp
    from app.modules.users.routes import user_bp
    from app.modules.web.routes import web_bp
    from app.modules.wireless.routes import wireless_bp

    app.register_blueprint(web_bp)
    app.register_blueprint(auth_bp)
    app.register_blueprint(user_bp)
    app.register_blueprint(access_control_bp)
    app.register_blueprint(cache_bp)
    app.register_blueprint(dashboard_bp)
    app.register_blueprint(device_bp)
    app.register_blueprint(firewall_bp)
    app.register_blueprint(integration_status_bp)
    app.register_blueprint(sangfor_ac_bp)
    app.register_blueprint(legacy_status_bp)
    app.register_blueprint(wireless_bp)
