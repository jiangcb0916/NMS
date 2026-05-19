from flask import Blueprint, redirect, render_template, url_for
from flask_login import current_user, login_required


web_bp = Blueprint("web", __name__)


@web_bp.route("/")
@login_required
def index():
    return render_template("index.html")


@web_bp.route("/user-management")
@login_required
def user_management():
    return render_template("index.html")


@web_bp.route("/login")
def login_page():
    if current_user.is_authenticated:
        return redirect(url_for("web.index"))
    return render_template("login.html")
