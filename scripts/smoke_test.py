#!/usr/bin/env python3
import io
import os
import sys
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT_DIR))
os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")

from app import create_app
from app.extensions import db
from app.models.user import User


def main():
    app = create_app()

    with app.app_context():
        db.create_all()
        user = User(username="admin", full_name="系统管理员", role="admin", is_superuser=True)
        user.set_password("admin123")
        db.session.add(user)
        db.session.commit()

    client = app.test_client()
    login_response = client.post("/api/user/login", json={
        "username": "admin",
        "password": "admin123",
    })
    assert login_response.status_code == 200, login_response.get_data(as_text=True)

    summary_response = client.get("/api/dashboard/summary")
    assert summary_response.status_code == 200, summary_response.get_data(as_text=True)

    health_response = client.get("/api/health")
    assert health_response.status_code == 200, health_response.get_data(as_text=True)

    create_device_response = client.post("/api/access-control/device-list", json={
        "username": "smoke-device",
        "ip_address": "192.0.2.10",
        "mac_address": "00:11:22:33:44:55",
        "category": "smoke",
        "details": "smoke test",
    })
    assert create_device_response.status_code in {200, 201}, create_device_response.get_data(as_text=True)
    created_device = create_device_response.get_json()["data"]

    device_list_response = client.get("/api/access-control/device-list?q=smoke&category=smoke&page=1&per_page=10")
    assert device_list_response.status_code == 200, device_list_response.get_data(as_text=True)
    assert device_list_response.get_json()["data"]["total"] == 1
    assert device_list_response.get_json()["data"]["status_counts"]["offline"] == 1

    offline_device_response = client.get("/api/access-control/device-list?q=smoke&status=offline&page=1&per_page=10")
    assert offline_device_response.status_code == 200, offline_device_response.get_data(as_text=True)
    assert offline_device_response.get_json()["data"]["total"] == 1

    online_device_response = client.get("/api/access-control/device-list?q=smoke&status=online&page=1&per_page=10")
    assert online_device_response.status_code == 200, online_device_response.get_data(as_text=True)
    assert online_device_response.get_json()["data"]["total"] == 0

    update_device_response = client.put(f"/api/access-control/device-list/{created_device['id']}", json={
        "username": "smoke-device-edited",
        "ip_address": "192.0.2.10",
        "mac_address": "00:11:22:33:44:55",
        "category": "smoke-edited",
        "details": "updated",
    })
    assert update_device_response.status_code == 200, update_device_response.get_data(as_text=True)

    export_device_response = client.get("/api/access-control/device-list/export?q=smoke&status=offline")
    assert export_device_response.status_code == 200, export_device_response.get_data(as_text=True)
    assert b"smoke-device-edited" in export_device_response.data

    import_csv = "username,ip_address,mac_address,category,details\nsmoke-import-device,192.0.2.11,00:11:22:33:44:66,smoke-import,imported\n"
    import_device_response = client.post(
        "/api/access-control/device-list/import",
        data={"file": (io.BytesIO(import_csv.encode("utf-8")), "devices.csv")},
        content_type="multipart/form-data",
    )
    assert import_device_response.status_code == 200, import_device_response.get_data(as_text=True)
    assert import_device_response.get_json()["data"]["created"] == 1

    imported_list_response = client.get("/api/access-control/device-list?q=smoke-import-device")
    imported_device = imported_list_response.get_json()["data"]["devices"][0]
    delete_device_response = client.delete(f"/api/access-control/device-list/{created_device['id']}")
    assert delete_device_response.status_code == 200, delete_device_response.get_data(as_text=True)
    delete_imported_response = client.delete(f"/api/access-control/device-list/{imported_device['id']}")
    assert delete_imported_response.status_code == 200, delete_imported_response.get_data(as_text=True)

    create_response = client.post("/api/user/create", json={
        "username": "operator1",
        "password": "operator123",
        "full_name": "值班员",
        "role": "operator",
    })
    assert create_response.status_code in {200, 201}, create_response.get_data(as_text=True)
    created_user = create_response.get_json()["data"]

    reset_response = client.post(f"/api/user/{created_user['id']}/reset-password", json={
        "new_password": "operator456",
    })
    assert reset_response.status_code == 200, reset_response.get_data(as_text=True)

    lock_response = client.post(f"/api/user/{created_user['id']}/lock", json={"minutes": 5})
    assert lock_response.status_code == 200, lock_response.get_data(as_text=True)

    unlock_response = client.post(f"/api/user/{created_user['id']}/unlock")
    assert unlock_response.status_code == 200, unlock_response.get_data(as_text=True)

    openvpn_response = client.get("/api/openvpn/users")
    assert openvpn_response.status_code == 404, openvpn_response.get_data(as_text=True)

    print("smoke test passed")


if __name__ == "__main__":
    main()
