import json

from flask import current_app
from sqlalchemy import inspect
from sqlalchemy.exc import SQLAlchemyError

from app.extensions import db
from app.models.base import now_local
from app.models.event import Event


EVENT_STATUSES = {"open", "acknowledged", "resolved"}
EVENT_SEVERITIES = {"info", "warning", "critical"}
_event_table_ready_key = None


def ensure_event_table():
    global _event_table_ready_key
    engine_key = str(db.engine.url)
    if _event_table_ready_key == engine_key:
        return

    inspector = inspect(db.engine)
    if not inspector.has_table(Event.__tablename__):
        Event.__table__.create(bind=db.engine, checkfirst=True)
    _event_table_ready_key = engine_key


def event_summary_payload():
    ensure_event_table()
    total = Event.query.count()
    status_counts = {
        "open": Event.query.filter_by(status="open").count(),
        "acknowledged": Event.query.filter_by(status="acknowledged").count(),
        "resolved": Event.query.filter_by(status="resolved").count(),
    }
    severity_counts = {
        severity: Event.query.filter_by(severity=severity).count()
        for severity in ["critical", "warning", "info"]
    }
    active_query = Event.query.filter(Event.status.in_(["open", "acknowledged"]))
    active_total = active_query.count()
    critical_active = active_query.filter_by(severity="critical").count()
    warning_active = active_query.filter_by(severity="warning").count()
    recent = [
        item.to_dict()
        for item in active_query.order_by(Event.last_seen.desc()).limit(5).all()
    ]
    sources = [
        row[0]
        for row in db.session.query(Event.source)
        .filter(Event.status.in_(["open", "acknowledged"]))
        .distinct()
        .order_by(Event.source.asc())
        .all()
    ]
    return {
        "total": total,
        "active_total": active_total,
        "critical_active": critical_active,
        "warning_active": warning_active,
        "unacknowledged": status_counts["open"],
        "status_counts": status_counts,
        "severity_counts": severity_counts,
        "recent": recent,
        "active_sources": sources,
    }


def upsert_event(event_key, source, severity, title, message="", details=None):
    ensure_event_table()
    severity = severity if severity in EVENT_SEVERITIES else "warning"
    timestamp = now_local()
    event = Event.query.filter_by(event_key=event_key).first()
    details_text = serialize_details(details)
    if event is None:
        event = Event(
            event_key=event_key,
            source=source,
            severity=severity,
            title=title,
            message=message,
            details=details_text,
            first_seen=timestamp,
            last_seen=timestamp,
            status="open",
        )
        db.session.add(event)
    else:
        event.source = source
        event.severity = severity
        event.title = title
        event.message = message
        event.details = details_text
        event.last_seen = timestamp
        event.occurrence_count += 1
        if event.status == "resolved":
            event.status = "open"
            event.resolved_at = None
            event.acknowledged_at = None
    db.session.commit()
    return event


def resolve_event(event_key):
    ensure_event_table()
    event = Event.query.filter_by(event_key=event_key).first()
    if event is None or event.status == "resolved":
        return event
    timestamp = now_local()
    event.status = "resolved"
    event.resolved_at = timestamp
    event.updated_at = timestamp
    db.session.commit()
    return event


def sync_integration_events(items):
    for item in items:
        key = item.get("key") or "unknown"
        label = item.get("label") or key
        event_key = f"integration:{key}"
        source = label
        configured = bool(item.get("configured"))
        ok = bool(item.get("ok"))
        message = item.get("message") or ""
        if configured and ok:
            resolve_event(event_key)
        else:
            severity = "critical" if configured else "warning"
            title = f"{label}{'异常' if configured else '未配置'}"
            upsert_event(event_key, source, severity, title, message, {
                "configured": configured,
                "ok": ok,
                "seconds": item.get("seconds", 0),
                "details": item.get("details") or {},
            })


def sync_dashboard_events(payload):
    checks = [
        ("dashboard:firewall", "华为防火墙", payload.get("firewall") or {}, "防火墙状态异常"),
        ("dashboard:switches", "交换机", payload.get("switches") or {}, "交换机监控异常"),
        ("dashboard:wireless", "无线控制器", payload.get("wireless") or {}, "无线控制器异常"),
        ("dashboard:osdwan", "OSDWAN", payload.get("osdwan") or {}, "OSDWAN 状态异常"),
        ("dashboard:sangfor_ac", "深信服 AC", payload.get("traffic_apps") or {}, "深信服 AC 异常"),
        ("dashboard:access_control", "联软准入", payload.get("access_clients") or {}, "联软准入异常"),
    ]
    for event_key, source, item, fallback_title in checks:
        configured = bool(item.get("configured"))
        ok = bool(item.get("ok"))
        if configured and ok:
            resolve_event(event_key)
            continue
        severity = "critical" if configured else "warning"
        title = fallback_title if configured else f"{source}未配置"
        message = item.get("error") or item.get("message") or ("未配置" if not configured else "状态异常")
        upsert_event(event_key, source, severity, title, message, compact_dashboard_details(item))


def compact_dashboard_details(item):
    safe_keys = [
        "configured",
        "ok",
        "total",
        "online",
        "offline",
        "user_count",
        "user_capacity",
        "node_name",
        "source",
        "total_apps",
    ]
    return {key: item.get(key) for key in safe_keys if key in item}


def serialize_details(details):
    if not isinstance(details, dict):
        return None
    return json.dumps(details, ensure_ascii=False, sort_keys=True)


def safe_event_summary():
    try:
        return event_summary_payload()
    except SQLAlchemyError as exc:
        db.session.rollback()
        current_app.logger.warning("事件摘要读取失败: %s", exc.__class__.__name__)
    except Exception as exc:
        current_app.logger.warning("事件摘要读取失败: %s", exc.__class__.__name__)
    return {
        "total": 0,
        "active_total": 0,
        "critical_active": 0,
        "warning_active": 0,
        "unacknowledged": 0,
        "status_counts": {"open": 0, "acknowledged": 0, "resolved": 0},
        "severity_counts": {"critical": 0, "warning": 0, "info": 0},
        "recent": [],
        "active_sources": [],
    }


def safe_sync_dashboard_events(payload):
    try:
        sync_dashboard_events(payload)
    except SQLAlchemyError as exc:
        db.session.rollback()
        current_app.logger.warning("仪表盘事件同步失败: %s", exc.__class__.__name__)
    except Exception as exc:
        current_app.logger.warning("仪表盘事件同步失败: %s", exc.__class__.__name__)
