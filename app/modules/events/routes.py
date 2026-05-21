from flask import Blueprint, request
from flask_login import login_required
from sqlalchemy import or_

from app.common.responses import failure, success
from app.extensions import db
from app.models.base import now_local
from app.models.event import Event
from app.modules.events.service import EVENT_SEVERITIES, EVENT_STATUSES, ensure_event_table, event_summary_payload


events_bp = Blueprint("events_api", __name__, url_prefix="/api/events")


@events_bp.route("", methods=["GET"])
@login_required
def event_list():
    ensure_event_table()
    page = bounded_int(request.args.get("page"), 1, 1, 100000)
    per_page = bounded_int(request.args.get("per_page"), 20, 1, 100)
    query_text = (request.args.get("q") or "").strip()
    source = (request.args.get("source") or "").strip()
    severity = (request.args.get("severity") or "").strip()
    status = (request.args.get("status") or "").strip()

    query = Event.query
    if query_text:
        like = f"%{query_text}%"
        query = query.filter(
            or_(
                Event.title.ilike(like),
                Event.message.ilike(like),
                Event.source.ilike(like),
                Event.event_key.ilike(like),
            )
        )
    if source:
        query = query.filter_by(source=source)
    if severity in EVENT_SEVERITIES:
        query = query.filter_by(severity=severity)
    if status in EVENT_STATUSES:
        query = query.filter_by(status=status)

    total = query.count()
    pages = (total + per_page - 1) // per_page if total else 0
    if pages:
        page = min(page, pages)
    rows = (
        query.order_by(Event.last_seen.desc(), Event.id.desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
        .all()
    )
    sources = [
        row[0]
        for row in db.session.query(Event.source)
        .distinct()
        .order_by(Event.source.asc())
        .all()
    ]
    return success({
        "events": [row.to_dict() for row in rows],
        "page": page,
        "per_page": per_page,
        "pages": pages,
        "total": total,
        "returned": len(rows),
        "query": query_text,
        "source": source,
        "severity": severity,
        "status": status,
        "sources": sources,
        "summary": event_summary_payload(),
    })


@events_bp.route("/summary", methods=["GET"])
@login_required
def event_summary():
    return success(event_summary_payload())


@events_bp.route("/<int:event_id>/ack", methods=["POST"])
@login_required
def acknowledge_event(event_id):
    ensure_event_table()
    event = Event.query.get(event_id)
    if event is None:
        return failure("事件不存在", status=404)
    if event.status != "resolved":
        event.status = "acknowledged"
        event.acknowledged_at = now_local()
        db.session.commit()
    return success(event.to_dict(), message="事件已确认")


@events_bp.route("/<int:event_id>/resolve", methods=["POST"])
@login_required
def resolve_event_route(event_id):
    ensure_event_table()
    event = Event.query.get(event_id)
    if event is None:
        return failure("事件不存在", status=404)
    event.status = "resolved"
    event.resolved_at = now_local()
    db.session.commit()
    return success(event.to_dict(), message="事件已恢复")


def bounded_int(value, default, minimum, maximum):
    try:
        number = int(value)
    except (TypeError, ValueError):
        number = default
    return max(minimum, min(maximum, number))
