#!/usr/bin/env python3
import os
import secrets
import sys
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT_DIR))

from app import create_app
from app.extensions import db
from app.models.user import User


def main():
    app = create_app()

    with app.app_context():
        db.create_all()

        username = os.environ.get("ADMIN_USERNAME", "admin")
        password = os.environ.get("ADMIN_PASSWORD")
        generated_password = False

        if not password:
            password = secrets.token_urlsafe(12)
            generated_password = True

        reset_password = os.environ.get("RESET_ADMIN_PASSWORD") == "1"
        admin = User.query.filter_by(username=username).first()
        if not admin:
            admin = User(
                username=username,
                email=os.environ.get("ADMIN_EMAIL"),
                full_name=os.environ.get("ADMIN_FULL_NAME", "系统管理员"),
                role="admin",
                is_superuser=True,
                is_active=True,
            )
            admin.set_password(password)
            db.session.add(admin)
            db.session.commit()
            print("数据库初始化完成")
            print(f"管理员账号: {username}")
            print(f"管理员密码: {password}")
            if generated_password:
                print("该密码为临时生成，请首次登录后修改")
        elif reset_password:
            admin.set_password(password)
            db.session.commit()
            print("数据库初始化完成，管理员密码已重置")
            print(f"管理员账号: {username}")
            print(f"管理员密码: {password}")
            if generated_password:
                print("该密码为临时生成，请首次登录后修改")
        else:
            print("数据库初始化完成，管理员账号已存在")


if __name__ == "__main__":
    main()
