#!/usr/bin/env python3
from app import create_app


app = create_app()


if __name__ == "__main__":
    host = app.config.get("HOST", "127.0.0.1")
    port = int(app.config.get("PORT", 5001))
    debug = bool(app.config.get("DEBUG", False))

    print("启动网络管理系统 Next")
    print(f"访问地址: http://{host}:{port}")
    print(f"调试模式: {debug}")
    app.run(host=host, port=port, debug=debug)
