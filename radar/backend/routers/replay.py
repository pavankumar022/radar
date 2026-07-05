"""
RADAR — Replay Router
POST /api/replay/start  — start replay at configurable speed
POST /api/replay/stop   — stop active replay
GET  /api/replay/status — current replay state
"""
import logging
from fastapi import APIRouter

from backend.services.replay_engine import replay_engine
from backend.routers.alerts import broadcast_event
from backend.state import app_state

log = logging.getLogger(__name__)
router = APIRouter(prefix="/api/replay")


@router.post("/start")
async def start_replay(body: dict):
    """
    Start replaying stored events at configurable speed.
    Body: {"speed_multiplier": 1.0, "incident_id": null}
    """
    speed = float(body.get("speed_multiplier", 1.0))
    speed = max(0.5, min(speed, 500.0))

    # Signal UI that replay is active
    app_state.feed_state = "SYNTHETIC_FEED"

    await replay_engine.start(speed_multiplier=speed, on_event=broadcast_event)

    return {
        "status": "started",
        "speed_multiplier": speed,
        **replay_engine.status,
    }


@router.post("/stop")
async def stop_replay():
    """Stop active replay session."""
    await replay_engine.stop()
    if app_state.monitoring_active:
        app_state.feed_state = "SYNTHETIC_FEED" if app_state.input_mode == "synthetic" else "LIVE_FEED_ACTIVE"
    else:
        app_state.feed_state = "SYSTEM_STANDBY"
    return {"status": "stopped", **replay_engine.status}


@router.get("/status")
async def get_replay_status():
    """Current replay engine state."""
    return replay_engine.status
