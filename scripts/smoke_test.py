#!/usr/bin/env python3
import io
import os
import sys
import time
from datetime import timedelta
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT_DIR))
os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")

from app import create_app
from app.extensions import db
from app.models.base import now_local
from app.models.cache import UserNameCache
from app.models.user import User
from app.modules.access_control import name_cache as access_control_name_cache
from app.modules.access_control import routes as access_control_routes
from app.modules.dashboard import routes as dashboard_routes
from app.modules.events.service import upsert_event
from app.modules.firewall import routes as firewall_routes
from app.modules.osdwan import routes as osdwan_routes
from app.modules.sangfor_ac import routes as sangfor_ac_routes
from app.modules.switches import routes as switch_routes
from app.modules.wireless import routes as wireless_routes


def hex_text(value):
    return "0x" + value.encode("utf-8").hex()


def main():
    app = create_app()

    with app.app_context():
        db.create_all()
        user = User(username="admin", full_name="系统管理员", role="admin", is_superuser=True)
        user.set_password("admin123")
        db.session.add(user)
        db.session.add(UserNameCache(
            mobile="13800000001",
            real_name="张三",
            expires_at=now_local() + timedelta(hours=24),
        ))
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

    with app.app_context():
        smoke_event = upsert_event(
            "smoke:event",
            "smoke",
            "warning",
            "smoke event",
            "smoke event message",
            {"safe": True},
        )
        smoke_event_id = smoke_event.id

    events_response = client.get("/api/events")
    assert events_response.status_code == 200, events_response.get_data(as_text=True)
    events_data = events_response.get_json()["data"]
    assert events_data["total"] == 1
    assert events_data["summary"]["unacknowledged"] == 1

    ack_event_response = client.post(f"/api/events/{smoke_event_id}/ack")
    assert ack_event_response.status_code == 200, ack_event_response.get_data(as_text=True)
    resolve_event_response = client.post(f"/api/events/{smoke_event_id}/resolve")
    assert resolve_event_response.status_code == 200, resolve_event_response.get_data(as_text=True)

    class FakeAccessControlClient:
        configured = True

        def query_devices(self, **params):
            return {
                "status": "SUCCESS",
                "rows": [
                    {
                        "strdevip": "192.0.2.31",
                        "strusername": "13800000001",
                        "strdevname": "PC-A",
                        "strmac": "00:11:22:33:44:31",
                        "strdeptname": "LDAP",
                        "status": 1,
                        "stros": "Windows",
                        "strosversion": "11 Pro",
                    },
                    {
                        "strdevip": "192.0.2.32",
                        "strusername": "13800000002",
                        "strdevname": "PC-B",
                        "strmac": "00:11:22:33:44:32",
                        "strdeptname": "LDAP",
                        "status": 0,
                        "stros": "macOS",
                        "strosversion": "14.5",
                    },
                ],
            }

    original_access_control_client = access_control_routes.AccessControlClient
    original_dingtalk_client = access_control_routes.DingTalkClient
    original_name_cache_dingtalk_client = access_control_name_cache.DingTalkClient
    access_control_routes.AccessControlClient = FakeAccessControlClient
    class FakeDingTalkClient:
        configured = True

        def get_name_by_mobile(self, mobile):
            return {
                "13800000002": "冯雪珂",
            }.get(mobile)

    access_control_routes.DingTalkClient = FakeDingTalkClient
    access_control_name_cache.DingTalkClient = FakeDingTalkClient
    try:
        client_list_response = client.get("/api/access-control/client-list?q=windows&status=online&page=1&per_page=10")
        assert client_list_response.status_code == 200, client_list_response.get_data(as_text=True)
        client_list_data = client_list_response.get_json()["data"]
        assert client_list_data["total"] == 1
        assert client_list_data["status"] == "online"
        assert client_list_data["status_counts"] == {"all": 1, "online": 1, "offline": 0}
        assert client_list_data["name_cache_refresh"]["missing"] == 0
        assert client_list_data["client_list"][0]["real_name"] == "张三"
        assert client_list_data["client_list"][0]["os"] == "Windows"
        assert client_list_data["client_list"][0]["os_version"] == "11 Pro"

        name_search_response = client.get("/api/access-control/client-list?q=张三&page=1&per_page=10")
        assert name_search_response.status_code == 200, name_search_response.get_data(as_text=True)
        name_search_data = name_search_response.get_json()["data"]
        assert name_search_data["total"] == 1
        assert name_search_data["client_list"][0]["username"] == "13800000001"
        assert name_search_data["client_list"][0]["real_name"] == "张三"

        uncached_name_search_response = client.get("/api/access-control/client-list?q=冯雪珂&page=1&per_page=10")
        assert uncached_name_search_response.status_code == 200, uncached_name_search_response.get_data(as_text=True)
        uncached_name_search_data = uncached_name_search_response.get_json()["data"]
        assert uncached_name_search_data["total"] == 1
        assert uncached_name_search_data["client_list"][0]["username"] == "13800000002"
        assert uncached_name_search_data["client_list"][0]["real_name"] == "冯雪珂"
    finally:
        access_control_routes.AccessControlClient = original_access_control_client
        access_control_routes.DingTalkClient = original_dingtalk_client
        access_control_name_cache.DingTalkClient = original_name_cache_dingtalk_client

    class FakeSangforACClient:
        host = "172.16.100.4"
        port = 9999
        configured = True

        @property
        def base_url(self):
            return f"http://{self.host}:{self.port}"

        def get_user_rank(self, top=10000, line="0"):
            assert top == 10000
            assert line == "0"
            return {
                "code": 0,
                "message": "Successfully",
                "data": [
                    {
                        "id": 0,
                        "name": "13800000001",
                        "group": "/研发",
                        "ip": "192.0.2.41",
                        "up": 1000,
                        "down": 2000,
                        "total": 3000,
                        "session": 12,
                        "status": True,
                        "detail": {"data": [{"app": "访问网站", "percent": 100, "up": 1000, "down": 2000, "total": 3000}]},
                    },
                    {
                        "id": 1,
                        "name": "ea-ad-0b-ba-e6-09(26-a3-f1-d9-4d-4f)",
                        "group": "/财务",
                        "ip": "192.0.2.42",
                        "up": 10,
                        "down": 20,
                        "total": 30,
                        "session": 1,
                        "status": False,
                        "detail": {"data": []},
                    },
                ],
            }

        def get_app_rank(self, top=60, groups=None, line="0"):
            assert top == 10
            assert groups is None
            assert line == "0"
            return {
                "code": 0,
                "message": "Successfully",
                "data": [
                    {
                        "app": "访问网站",
                        "up": 1000,
                        "down": 2000,
                        "total": 3000,
                        "rate": 75,
                    },
                    {
                        "app": "钉钉",
                        "up": 500,
                        "down": 500,
                        "total": 1000,
                        "rate": 25,
                    },
                ],
            }

    original_sangfor_ac_client = sangfor_ac_routes.SangforACClient
    sangfor_ac_routes.SangforACClient = FakeSangforACClient
    try:
        traffic_response = client.get("/api/sangfor/user-rank?q=张三&page=1&per_page=10&top=10000")
        assert traffic_response.status_code == 200, traffic_response.get_data(as_text=True)
        traffic_data = traffic_response.get_json()["data"]
        assert traffic_data["total"] == 1
        assert traffic_data["items"][0]["ip"] == "192.0.2.41"
        assert traffic_data["items"][0]["real_name"] == "张三"
        assert traffic_data["items"][0]["total_rate"] == "24 Kbps"
        assert traffic_data["summary"]["user_count"] == 2
        assert traffic_data["summary"]["session_count"] == 13

        mac_search_response = client.get("/api/sangfor/user-rank?q=ea-ad-0b&page=1&per_page=10&top=10000")
        assert mac_search_response.status_code == 200, mac_search_response.get_data(as_text=True)
        mac_search_data = mac_search_response.get_json()["data"]
        assert mac_search_data["total"] == 1
        assert mac_search_data["items"][0]["name"] == "ea-ad-0b-ba-e6-09"
    finally:
        sangfor_ac_routes.SangforACClient = original_sangfor_ac_client

    class FakePrometheusClient:
        query_configured = True
        metrics_configured = False

        def query(self, expression):
            assert 'auth="nac"' in expression
            assert 'instance="172.16.100.7"' in expression
            assert 'job="ND"' in expression
            assert 'module="mgmt,private"' in expression
            if "sfUserNum" in expression:
                return [{"metric": {}, "value": [0, "3"]}]
            if "sfSysCpuCostRate" in expression:
                return [{"metric": {}, "value": [0, "13"]}]
            if "sfApOnlineNum" in expression:
                return [{"metric": {}, "value": [0, "1"]}]
            values = {
                "sfApName": {"1": hex_text("AP-A"), "2": hex_text("AP-B")},
                "sfApStatus": {"1": hex_text("Online"), "2": hex_text("Offline")},
                "sfApIP": {"1": "192.0.2.201", "2": "192.0.2.202"},
                "sfApMAC": {"1": "001122334455", "2": "001122334466"},
                "sfApRecvRate": {"1": hex_text("1 Mbps"), "2": hex_text("0 bps")},
                "sfApSendRate": {"1": hex_text("2 Mbps"), "2": hex_text("0 bps")},
            }
            if "sfApUsrNum" in expression:
                return [
                    {"metric": {"apIndex": "1"}, "value": [0, "3"]},
                    {"metric": {"apIndex": "2"}, "value": [0, "0"]},
                ]
            for metric_name, metric_values in values.items():
                if metric_name in expression:
                    return [
                        {"metric": {"apIndex": index, metric_name: value}, "value": [0, "1"]}
                        for index, value in metric_values.items()
                    ]
            return []

        def metrics_text(self):
            return ""

    class FakeSwitchPrometheusClient:
        query_configured = True
        targets_configured = True

        def __init__(self):
            self.timeout = 10

        def targets(self, state="active"):
            return [
                {
                    "discoveredLabels": {
                        "__address__": "172.16.100.5",
                        "auth": "huawei",
                        "job": "sw",
                        "module": "huawei_acc,huawei_common",
                    },
                    "labels": {
                        "auth": "huawei",
                        "instance": "172.16.100.5",
                        "job": "sw",
                        "module": "huawei_acc,huawei_common",
                    },
                    "scrapePool": "sw",
                    "lastError": "",
                    "lastScrape": "2026-05-20T10:15:45.592263956+08:00",
                    "lastScrapeDuration": 13.83,
                    "health": "up",
                    "scrapeInterval": "2m",
                    "scrapeTimeout": "2m",
                },
                {
                    "discoveredLabels": {
                        "__address__": "172.16.100.12",
                        "auth": "h3c",
                        "job": "sw",
                        "module": "h3c_common",
                    },
                    "labels": {
                        "auth": "h3c",
                        "instance": "172.16.100.12",
                        "job": "sw",
                        "module": "h3c_common",
                    },
                    "scrapePool": "sw",
                    "lastError": "timeout",
                    "lastScrape": "2026-05-20T10:14:44.09845384+08:00",
                    "lastScrapeDuration": 120,
                    "health": "down",
                    "scrapeInterval": "2m",
                    "scrapeTimeout": "2m",
                },
                {
                    "discoveredLabels": {"__address__": "192.0.2.20", "job": "server"},
                    "labels": {"instance": "192.0.2.20", "job": "server"},
                    "health": "up",
                },
            ]

        def query(self, expression):
            assert 'job="sw"' in expression
            if 'instance="172.16.100.5"' not in expression:
                return []
            ports = [
                {
                    "labels": {
                        "instance": "172.16.100.5",
                        "job": "sw",
                        "ifIndex": "1",
                        "ifName": "GigabitEthernet1/0/1",
                        "ifAlias": "uplink-core",
                        "ifHighSpeed": "1000",
                        "ifOperStatus": "1",
                    },
                    "in_bps": "8000000",
                    "out_bps": "4000000",
                    "in_errors": "1",
                    "out_errors": "0",
                },
                {
                    "labels": {
                        "instance": "172.16.100.5",
                        "job": "sw",
                        "ifIndex": "2",
                        "ifName": "GigabitEthernet1/0/2",
                        "ifAlias": "office-downlink",
                        "ifHighSpeed": "1000",
                        "ifOperStatus": "2",
                    },
                    "in_bps": "0",
                    "out_bps": "0",
                    "in_errors": "0",
                    "out_errors": "2",
                },
                {
                    "labels": {
                        "instance": "172.16.100.5",
                        "job": "sw",
                        "ifIndex": "3",
                        "ifName": "Vlanif41",
                        "ifAlias": "Manage",
                        "ifHighSpeed": "1000",
                        "ifOperStatus": "1",
                    },
                    "in_bps": "100000",
                    "out_bps": "200000",
                    "in_errors": "0",
                    "out_errors": "0",
                },
                {
                    "labels": {
                        "instance": "172.16.100.5",
                        "job": "sw",
                        "ifIndex": "4",
                        "ifName": "NULL0",
                        "ifAlias": "",
                        "ifHighSpeed": "0",
                        "ifOperStatus": "1",
                    },
                    "in_bps": "0",
                    "out_bps": "0",
                    "in_errors": "0",
                    "out_errors": "0",
                },
            ]
            ports.extend([
                {
                    "labels": {
                        "instance": "172.16.100.5",
                        "job": "sw",
                        "ifIndex": str(index),
                        "ifName": f"GigabitEthernet1/0/{index}",
                        "ifAlias": f"access-{index}",
                        "ifHighSpeed": "1000",
                        "ifOperStatus": "1",
                    },
                    "in_bps": str(index * 1000),
                    "out_bps": str(index * 2000),
                    "in_errors": "0",
                    "out_errors": "0",
                }
                for index in range(5, 17)
            ])
            metric_map = {
                "ifHCInOctets": "in_bps",
                "ifHCOutOctets": "out_bps",
                "ifInErrors": "in_errors",
                "ifOutErrors": "out_errors",
            }
            for metric_name, value_key in metric_map.items():
                if metric_name in expression:
                    return [
                        {"metric": port["labels"], "value": [0, port[value_key]]}
                        for port in ports
                    ]
            return []

        def query_range(self, expression, start, end, step):
            assert 'job="sw"' in expression
            assert 'instance="172.16.100.5"' in expression
            assert "rate(" in expression
            if "ifHCInOctets" in expression:
                values = ["12000000", "14000000", "16000000"]
            elif "ifHCOutOctets" in expression:
                values = ["4000000", "3000000", "5000000"]
            else:
                values = ["0", "0", "0"]
            base = int(end) - 120
            return [{
                "metric": {},
                "values": [
                    [base, values[0]],
                    [base + 60, values[1]],
                    [base + 120, values[2]],
                ],
            }]

    original_prometheus_client = wireless_routes.PrometheusClient
    original_switch_prometheus_client = switch_routes.PrometheusClient
    wireless_routes.PrometheusClient = FakePrometheusClient
    switch_routes.PrometheusClient = FakeSwitchPrometheusClient
    try:
        ap_response = client.get("/api/statistics/ap-info?page=1&per_page=10&status=online&q=AP-A")
        assert ap_response.status_code == 200, ap_response.get_data(as_text=True)
        ap_data = ap_response.get_json()["data"]
        assert ap_data["total_aps"] == 1
        assert ap_data["status_counts"] == {"all": 1, "online": 1, "offline": 0}
        assert ap_data["ap_list"][0]["ap_name"] == "AP-A"

        offline_ap_response = client.get("/api/statistics/ap-info?page=1&per_page=10&status=offline")
        assert offline_ap_response.status_code == 200, offline_ap_response.get_data(as_text=True)
        assert offline_ap_response.get_json()["data"]["total_aps"] == 1

        sorted_ap_response = client.get("/api/statistics/ap-info?page=1&per_page=10&sort_by=ap_send_rate&sort_order=desc")
        assert sorted_ap_response.status_code == 200, sorted_ap_response.get_data(as_text=True)
        sorted_ap_data = sorted_ap_response.get_json()["data"]
        assert sorted_ap_data["sort_by"] == "ap_send_rate"
        assert sorted_ap_data["sort_order"] == "desc"
        assert sorted_ap_data["ap_list"][0]["ap_name"] == "AP-A"

        switch_response = client.get("/api/statistics/switches?page=1&per_page=10&status=online&vendor=huawei")
        assert switch_response.status_code == 200, switch_response.get_data(as_text=True)
        switch_data = switch_response.get_json()["data"]
        assert switch_data["total"] == 1
        assert switch_data["all_total"] == 2
        assert switch_data["status_counts"] == {"all": 1, "online": 1, "offline": 0}
        assert switch_data["vendor_counts"] == {"h3c": 1, "huawei": 1}
        assert switch_data["switch_list"][0]["instance"] == "172.16.100.5"
        assert switch_data["switch_list"][0]["last_scrape_at"] == "2026-05-20 10:15:45"

        switch_ports_response = client.get("/api/statistics/switches/172.16.100.5/ports?page=1&q=uplink&status=online")
        assert switch_ports_response.status_code == 200, switch_ports_response.get_data(as_text=True)
        switch_ports_data = switch_ports_response.get_json()["data"]
        assert switch_ports_data["total"] == 1
        assert switch_ports_data["scoped_total"] == 14
        assert switch_ports_data["all_total"] == 16
        assert switch_ports_data["hidden_total"] == 2
        assert switch_ports_data["page"] == 1
        assert switch_ports_data["per_page"] == 10
        assert switch_ports_data["pages"] == 1
        assert switch_ports_data["returned"] == 1
        assert switch_ports_data["scope"] == "business"
        assert switch_ports_data["summary"]["online_count"] == 1
        assert switch_ports_data["summary"]["total_in_rate"] == "8.00 Mbps"
        assert switch_ports_data["ports"][0]["if_name"] == "GigabitEthernet1/0/1"
        assert switch_ports_data["ports"][0]["is_online"] is True
        assert switch_ports_data["ports"][0]["utilization_text"] == "0.80%"

        switch_second_page_response = client.get("/api/statistics/switches/172.16.100.5/ports?scope=business&page=2&per_page=10")
        assert switch_second_page_response.status_code == 200, switch_second_page_response.get_data(as_text=True)
        switch_second_page_data = switch_second_page_response.get_json()["data"]
        assert switch_second_page_data["total"] == 14
        assert switch_second_page_data["pages"] == 2
        assert switch_second_page_data["page"] == 2
        assert switch_second_page_data["returned"] == 4

        switch_all_ports_response = client.get("/api/statistics/switches/172.16.100.5/ports?scope=all&q=Vlanif")
        assert switch_all_ports_response.status_code == 200, switch_all_ports_response.get_data(as_text=True)
        switch_all_ports_data = switch_all_ports_response.get_json()["data"]
        assert switch_all_ports_data["total"] == 1
        assert switch_all_ports_data["scoped_total"] == 16
        assert switch_all_ports_data["hidden_total"] == 0
        assert "Vlanif41" in {port["if_name"] for port in switch_all_ports_data["ports"]}

        switch_history_response = client.get("/api/statistics/switches/172.16.100.5/traffic-history?range=5m")
        assert switch_history_response.status_code == 200, switch_history_response.get_data(as_text=True)
        switch_history_data = switch_history_response.get_json()["data"]
        assert switch_history_data["range"] == "5m"
        assert switch_history_data["range_seconds"] == 300
        assert switch_history_data["scope"] == "business"
        assert switch_history_data["sample_count"] == 3
        assert switch_history_data["samples"][-1]["total_in_mbps"] == 16
        assert switch_history_data["samples"][-1]["total_out_rate"] == "5.00 Mbps"
    finally:
        wireless_routes.PrometheusClient = original_prometheus_client
        switch_routes.PrometheusClient = original_switch_prometheus_client

    class FakeOsdwanResponse:
        def __init__(self, payload):
            self.payload = payload

        def raise_for_status(self):
            return None

        def json(self):
            return self.payload

    def fake_osdwan_get(url, params=None, headers=None, timeout=15):
        assert headers["Authorization"] == "Bearer smoke-token"
        assert headers["Origin"] == "https://console.wanflow.com"
        if url.endswith("/api/user"):
            assert params == {"page": 1, "per_page": 200, "no_cache": 1}
            return FakeOsdwanResponse({"data": [
                {
                    "id": 1,
                    "name": "alice/amy",
                    "email": "alice@example.com",
                    "roles": ["admin"],
                    "face_verified": True,
                    "departments": [{"id": 32, "name": "出口1"}],
                    "proxies": [{"id": 48291, "name": "美国", "type": "socks5"}],
                },
                {
                    "id": 2,
                    "name": "bob",
                    "email": "bob@example.com",
                    "roles": ["user"],
                    "face_verified": False,
                    "proxies": [{"id": 49117, "name": "美国2", "type": "socks5"}],
                },
            ], "pagination": {"total": 2, "per_page": 200, "current_page": 1, "last_page": 1}})
        if url.endswith("/api/Saas/all-network-stats"):
            assert params["period"] == "1day"
            return FakeOsdwanResponse({"data": [
                {"time": 1760000000, "total_download_speed": 21549.83, "total_upload_speed": 9895.78},
                {"time": 1760000300, "total_download_speed": 180000, "total_upload_speed": 60000},
            ]})
        if url.endswith("/api/Saas/network-stats/2168"):
            assert params["period"] == "6hours"
            assert params["view_type"] == "total"
            return FakeOsdwanResponse({"data": {"list": [
                {"timestamp": 1760000000, "down_speed": "9318750", "up_speed": "3750000"},
                {"timestamp": 1760000300, "down_speed": "18750000", "up_speed": "6250000"},
            ]}})
        raise AssertionError(url)

    def fake_osdwan_post(url, json=None, headers=None, timeout=15):
        assert headers["Authorization"] == "Bearer smoke-token"
        assert headers["Origin"] == "https://console.wanflow.com"
        if url.endswith("/api/proxy/48291/check-connectivity"):
            return FakeOsdwanResponse({"data": {
                "proxy_id": 48291,
                "proxy_name": "美国",
                "is_connected": True,
                "ip": "203.0.113.8",
                "status": "success",
                "raw_result": {"response_time": 100},
            }})
        if url.endswith("/api/proxy/49117/check-connectivity"):
            return FakeOsdwanResponse({"data": {
                "proxy_id": 49117,
                "proxy_name": "美国2",
                "is_connected": True,
                "ip": "203.0.113.9",
                "status": "success",
                "raw_result": {"response_time": 120},
            }})
        raise AssertionError(url)

    original_osdwan_get = osdwan_routes.requests.get
    original_osdwan_post = osdwan_routes.requests.post
    app.config["OSDWAN_TOKEN"] = "smoke-token"
    app.config["OSDWAN_NODE_NAME"] = "办公开发"
    app.config["OSDWAN_USER_CAPACITY"] = 30
    osdwan_routes.requests.get = fake_osdwan_get
    osdwan_routes.requests.post = fake_osdwan_post
    try:
        osdwan_response = client.get("/api/osdwan/overview")
        assert osdwan_response.status_code == 200, osdwan_response.get_data(as_text=True)
        osdwan_data = osdwan_response.get_json()["data"]
        assert osdwan_data["configured"] is True
        assert osdwan_data["user_count"] == 2
        assert osdwan_data["overall_user_count"] == 2
        assert osdwan_data["user_capacity"] == 30
        assert osdwan_data["user_pagination"]["returned"] == 2
        assert osdwan_data["users"][0]["username"] == "alice/amy"
        assert osdwan_data["users"][0]["people"] == ["alice", "amy"]
        assert osdwan_data["users"][0]["departments"] == "出口1"
        assert osdwan_data["users"][0]["proxy_ips"] == "203.0.113.8"
        assert osdwan_data["user_departments"] == [{"name": "出口1", "count": 1}]
        assert osdwan_data["users"][0]["role"] == "admin"
        assert osdwan_data["user_people_count"] == 3
        assert osdwan_data["overall_user_people_count"] == 3
        assert osdwan_data["user_multi_account_count"] == 1
        assert osdwan_data["overall_user_multi_account_count"] == 1
        assert osdwan_data["proxy_status"]["total"] == 2
        assert osdwan_data["proxy_status"]["online"] == 2
        assert osdwan_data["user_people"][0]["name"] == "alice"
        assert osdwan_data["all_stats"]["sample_count"] == 2
        assert osdwan_data["all_stats"]["samples"][0]["download_mbps"] == 0.172
        assert osdwan_data["all_stats"]["samples"][0]["upload_mbps"] == 0.079
        assert osdwan_data["all_stats"]["samples"][0]["download_rate"] == "172 Kbps"
        assert osdwan_data["all_stats"]["samples"][0]["upload_rate"] == "79 Kbps"
        assert osdwan_data["all_stats"]["latest"]["download_mbps"] == 1.44
        assert osdwan_data["node"]["name"] == "办公开发"
        assert osdwan_data["node"]["stats"]["samples"][0]["download_mbps"] == 74.55
        assert osdwan_data["node"]["stats"]["latest"]["upload_mbps"] == 50

        osdwan_metrics_response = client.get("/api/osdwan/metrics")
        assert osdwan_metrics_response.status_code == 200, osdwan_metrics_response.get_data(as_text=True)
        osdwan_metrics = osdwan_metrics_response.get_json()["data"]
        assert osdwan_metrics["overall_user_count"] == 2
        assert osdwan_metrics["user_capacity"] == 30
        assert osdwan_metrics["overall_user_people_count"] == 3
        assert osdwan_metrics["proxy_status"]["total"] == 2
        assert osdwan_metrics["proxy_status"]["online"] == 2
        assert osdwan_metrics["all_stats"]["sample_count"] == 2
        assert osdwan_metrics["node"]["stats"]["sample_count"] == 2

        osdwan_metrics_period_response = client.get("/api/osdwan/metrics?all_period=1week&node_period=1hour")
        assert osdwan_metrics_period_response.status_code == 200, osdwan_metrics_period_response.get_data(as_text=True)
        osdwan_metrics_period = osdwan_metrics_period_response.get_json()["data"]
        assert osdwan_metrics_period["all_period"] == "1day"
        assert osdwan_metrics_period["node"]["period"] == "6hours"

        osdwan_users_response = client.get("/api/osdwan/users?user_q=bob&user_page=1&user_per_page=10")
        assert osdwan_users_response.status_code == 200, osdwan_users_response.get_data(as_text=True)
        osdwan_users = osdwan_users_response.get_json()["data"]
        assert osdwan_users["user_count"] == 1
        assert osdwan_users["overall_user_count"] == 2
        assert osdwan_users["user_query"] == "bob"
        assert osdwan_users["users"][0]["username"] == "bob"
        assert osdwan_users["user_people_count"] == 1
        assert osdwan_users["overall_user_people_count"] == 3

        osdwan_search_response = client.get("/api/osdwan/overview?user_q=bob")
        assert osdwan_search_response.status_code == 200, osdwan_search_response.get_data(as_text=True)
        osdwan_search = osdwan_search_response.get_json()["data"]
        assert osdwan_search["user_count"] == 1
        assert osdwan_search["overall_user_count"] == 2
        assert osdwan_search["user_query"] == "bob"
        assert osdwan_search["users"][0]["username"] == "bob"
        assert osdwan_search["user_people_count"] == 1
        assert osdwan_search["overall_user_people_count"] == 3

        osdwan_proxy_search_response = client.get("/api/osdwan/overview?user_q=203.0.113.8")
        assert osdwan_proxy_search_response.status_code == 200, osdwan_proxy_search_response.get_data(as_text=True)
        osdwan_proxy_search = osdwan_proxy_search_response.get_json()["data"]
        assert osdwan_proxy_search["user_count"] == 1
        assert osdwan_proxy_search["users"][0]["proxy_ips"] == "203.0.113.8"

        osdwan_department_response = client.get("/api/osdwan/overview", query_string={"user_department": "出口1"})
        assert osdwan_department_response.status_code == 200, osdwan_department_response.get_data(as_text=True)
        osdwan_department = osdwan_department_response.get_json()["data"]
        assert osdwan_department["user_department"] == "出口1"
        assert osdwan_department["user_count"] == 1
        assert osdwan_department["users"][0]["departments"] == "出口1"

        class FakeOsdwanErrorResponse(FakeOsdwanResponse):
            status_code = 500

            def raise_for_status(self):
                raise osdwan_routes.requests.HTTPError(response=self)

        def fake_osdwan_partial_get(url, params=None, headers=None, timeout=15):
            if url.endswith("/api/user"):
                return FakeOsdwanErrorResponse({"message": "Redis snapshot failed"})
            return fake_osdwan_get(url, params=params, headers=headers, timeout=timeout)

        osdwan_routes.requests.get = fake_osdwan_partial_get
        osdwan_partial_response = client.get("/api/osdwan/overview")
        assert osdwan_partial_response.status_code == 200, osdwan_partial_response.get_data(as_text=True)
        osdwan_partial = osdwan_partial_response.get_json()
        assert osdwan_partial["code"] == 0
        assert osdwan_partial["data"]["user_count"] == 0
        assert "HTTP 500" in osdwan_partial["data"]["errors"]["users"]
        assert osdwan_partial["data"]["all_stats"]["sample_count"] == 2
    finally:
        osdwan_routes.requests.get = original_osdwan_get
        osdwan_routes.requests.post = original_osdwan_post

    wireless_routes.wireless_user_cache["data"] = [
        {
            "user_index": "1",
            "phone_number": "13800000001",
            "real_name": "无",
            "ip_address": "192.0.2.101",
            "recv_rate": "1 Mbps",
            "send_rate": "512 Kbps",
            "stable_id": "ip_192.0.2.101",
        },
        {
            "user_index": "2",
            "phone_number": "审核人:13800000002",
            "real_name": "无",
            "ip_address": "192.0.2.102",
            "recv_rate": "2 Mbps",
            "send_rate": "768 Kbps",
            "stable_id": "ip_192.0.2.102",
        },
        {
            "user_index": "3",
            "phone_number": "无",
            "real_name": "无",
            "ip_address": "192.0.2.103",
            "recv_rate": "2 Mbps",
            "send_rate": "768 Kbps",
            "stable_id": "ip_192.0.2.103",
        },
        {
            "user_index": "4",
            "phone_number": "A8-B5-8E-E9-D8-D7",
            "real_name": "无",
            "ip_address": "N/A",
            "recv_rate": "0 bps",
            "send_rate": "0 bps",
            "stable_id": "temp_index_4",
        },
    ]
    wireless_routes.wireless_user_cache["last_update"] = time.time()
    wireless_users_response = client.get("/api/statistics/online-user-list?page=1&per_page=10&q=13800000001")
    assert wireless_users_response.status_code == 200, wireless_users_response.get_data(as_text=True)
    wireless_users_data = wireless_users_response.get_json()["data"]
    assert wireless_users_data["total_users"] == 1
    assert wireless_users_data["all_total_users"] == 3
    assert wireless_users_data["ssids"] == []
    assert wireless_users_data["user_list"][0]["real_name"] == "张三"
    assert wireless_routes.extract_mobile_number("审核人:13800000001") == "13800000001"
    assert wireless_routes.extract_mobile_number("A8-B5-8E-E9-D8-D7") is None
    first_stable_id = wireless_routes.wireless_user_stable_id("13800000001", "192.0.2.101", "1")
    same_stable_id = wireless_routes.wireless_user_stable_id("13800000001", "192.0.2.101", "99")
    different_stable_id = wireless_routes.wireless_user_stable_id("13800000001", "192.0.2.102", "1")
    assert first_stable_id == same_stable_id
    assert first_stable_id != different_stable_id
    assert wireless_routes.wireless_user_stable_id("无", "N/A", "4") == "temp_index_4"
    assert wireless_routes.wireless_rate_bps("1.5 Mbps") == 1500000
    sorted_wireless_response = client.get("/api/statistics/online-user-list?page=1&per_page=10&sort_by=send_rate&sort_order=desc&resolve_names=0")
    assert sorted_wireless_response.status_code == 200, sorted_wireless_response.get_data(as_text=True)
    sorted_wireless_data = sorted_wireless_response.get_json()["data"]
    assert sorted_wireless_data["sort_by"] == "send_rate"
    assert sorted_wireless_data["sort_order"] == "desc"
    assert sorted_wireless_data["user_list"][0]["send_rate"] == "768 Kbps"
    assert wireless_routes.wireless_rate_sort_key("N/A", "asc") > wireless_routes.wireless_rate_sort_key("0 bps", "asc")

    class FakeFirewallResponse:
        text = "\n".join([
            "hwCpuUsagePercent 11",
            "hwMemUsagePercent 22",
            "telecom_ifInOctets_total 1500000000",
            "telecom_ifOutOctets_total 1200000000",
            "unicom_ifInOctets_total 1300000000",
            "unicom_ifOutOctets_total 1100000000",
        ])

        def raise_for_status(self):
            return None

    class FakePrometheusRangeResponse:
        def __init__(self, query):
            self.query = query

        def raise_for_status(self):
            return None

        def json(self):
            now_ts = int(time.time())
            values = {
                "telecom_ifOutOctets_total": "10",
                "telecom_ifInOctets_total": "40",
                "unicom_ifOutOctets_total": "20",
                "unicom_ifInOctets_total": "60",
            }
            value = "0"
            for metric_name, metric_value in values.items():
                if metric_name in self.query:
                    value = metric_value
                    break
            return {
                "status": "success",
                "data": {
                    "result": [{
                        "values": [
                            [now_ts - 120, value],
                            [now_ts - 60, value],
                            [now_ts, value],
                        ]
                    }]
                },
            }

    def fake_firewall_get(url, params=None, timeout=10):
        if url == "http://172.16.80.125:9090/api/v1/query_range":
            query = params["query"]
            assert 'auth="secure_v3"' in query
            assert 'instance="172.16.100.3"' in query
            assert 'job="USG"' in query
            assert 'module="hw_health"' in query
            return FakePrometheusRangeResponse(query)
        assert url == "http://172.16.80.125:9116/snmp"
        assert params["auth"] == "secure_v3"
        assert params["module"] == "hw_health"
        assert params["target"] == "172.16.100.3"
        return FakeFirewallResponse()

    def fake_dashboard_get(url, params=None, headers=None, timeout=15):
        if url.startswith("https://api.wanflow.com"):
            return fake_osdwan_get(url, params=params, headers=headers, timeout=timeout)
        return fake_firewall_get(url, params=params, timeout=timeout)

    original_prometheus_client = wireless_routes.PrometheusClient
    original_switch_prometheus_client = switch_routes.PrometheusClient
    original_firewall_get = firewall_routes.requests.get
    original_bandwidth_history = firewall_routes.bandwidth_history
    original_bandwidth_samples = list(firewall_routes.bandwidth_samples)
    original_dashboard_access_control_client = dashboard_routes.AccessControlClient
    original_dashboard_osdwan_get = osdwan_routes.requests.get
    original_dashboard_osdwan_post = osdwan_routes.requests.post
    original_dashboard_sangfor_ac_client = sangfor_ac_routes.SangforACClient
    wireless_routes.PrometheusClient = FakePrometheusClient
    switch_routes.PrometheusClient = FakeSwitchPrometheusClient
    firewall_routes.requests.get = fake_dashboard_get
    firewall_routes.bandwidth_samples = []
    firewall_routes.bandwidth_history = {
        "time": time.time() - 10,
        "telecom_in": 1000000000,
        "telecom_out": 1000000000,
        "unicom_in": 1000000000,
        "unicom_out": 1000000000,
    }
    dashboard_routes.AccessControlClient = FakeAccessControlClient
    osdwan_routes.requests.get = fake_dashboard_get
    osdwan_routes.requests.post = fake_osdwan_post
    sangfor_ac_routes.SangforACClient = FakeSangforACClient
    try:
        overview_response = client.get("/api/dashboard/overview")
        assert overview_response.status_code == 200, overview_response.get_data(as_text=True)
        overview_data = overview_response.get_json()["data"]
        assert overview_data["access_clients"]["total"] == 2
        assert overview_data["firewall"]["configured"] is True
        assert overview_data["firewall"]["cpu_usage"] == 11
        assert overview_data["firewall"]["total_upload"] > 0
        assert overview_data["firewall"]["total_download"] > overview_data["firewall"]["total_upload"]
        assert overview_data["firewall"]["download_utilization"] > overview_data["firewall"]["upload_utilization"]
        assert overview_data["switches"]["total"] == 2
        assert overview_data["switches"]["online"] == 1
        assert overview_data["wireless"]["wireless_users"] == 3
        assert overview_data["osdwan"]["user_count"] == 2
        assert overview_data["osdwan"]["proxy_status"]["online"] == 2
        assert overview_data["traffic_apps"]["items"][0]["app"] == "访问网站"
        assert overview_data["tops"]["wireless_users"]["upload"][0]["value"] == "2 Mbps"
        assert overview_data["tops"]["aps"]["download"][0]["label"] == "AP-A"

        history_response = client.get("/api/status/huawei-firewall/bandwidth-history?limit=20&range=5m")
        assert history_response.status_code == 200, history_response.get_data(as_text=True)
        history_data = history_response.get_json()["data"]
        assert history_data["configured"] is True
        assert history_data["range"] == "5m"
        assert history_data["range_seconds"] == 300
        assert history_data["sample_count"] >= 1
        assert history_data["samples"][-1]["total_download"] >= history_data["samples"][-1]["total_upload"]
    finally:
        wireless_routes.PrometheusClient = original_prometheus_client
        switch_routes.PrometheusClient = original_switch_prometheus_client
        firewall_routes.requests.get = original_firewall_get
        firewall_routes.bandwidth_history = original_bandwidth_history
        firewall_routes.bandwidth_samples = original_bandwidth_samples
        dashboard_routes.AccessControlClient = original_dashboard_access_control_client
        osdwan_routes.requests.get = original_dashboard_osdwan_get
        osdwan_routes.requests.post = original_dashboard_osdwan_post
        sangfor_ac_routes.SangforACClient = original_dashboard_sangfor_ac_client

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
