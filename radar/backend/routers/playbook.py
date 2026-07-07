"""
RADAR — Playbook Router
POST /api/playbook/generate — generates AI IR playbook for a given alert ID
GET  /api/playbook/{alert_id} — retrieves existing playbook for an alert
"""
import logging
from fastapi import APIRouter, HTTPException, BackgroundTasks

from backend import database as db
from backend.services import playbook_gen
from backend.services.ws_manager import manager

log = logging.getLogger(__name__)
router = APIRouter(prefix="/api/playbook")


@router.post("/generate")
async def generate_playbook(request: dict, background_tasks: BackgroundTasks):
    """
    Generate an AI IR playbook for a given alert.
    Body: {"alert_id": "<uuid>", "provider": "gemini|claude|mock" (optional)}
    Returns the generated playbook immediately.
    """
    alert_id = request.get("alert_id")
    if not alert_id:
        raise HTTPException(400, "alert_id is required")

    # Check if already generated
    existing = await db.get_playbook_by_alert(alert_id)
    if existing:
        return existing

    # Load the event
    event = await db.get_event_by_id(alert_id)
    if not event:
        raise HTTPException(404, f"Alert {alert_id} not found")

    # Generate playbook
    provider = request.get("provider")
    playbook = await playbook_gen.generate_playbook(event, provider=provider)

    # Persist
    await db.save_playbook(playbook)
    await db.mark_event_playbook_generated(alert_id)

    # Notify WS clients
    background_tasks.add_task(
        manager.broadcast,
        {"type": "playbook_generated", "payload": {"alert_id": alert_id, "playbook_id": playbook["id"]}},
    )

    return playbook


@router.get("/{alert_id}")
async def get_playbook(alert_id: str):
    """Retrieve existing playbook for an alert, or 404 if not generated yet."""
    playbook = await db.get_playbook_by_alert(alert_id)
    if not playbook:
        raise HTTPException(404, "Playbook not generated for this alert")
    return playbook
