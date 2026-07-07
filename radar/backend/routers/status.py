"""
RADAR — Status Router
GET /api/status — system health, feed state, WS client count, uptime
GET /api/mitre  — current MITRE ATT&CK coverage (live tile states)
"""
import json
import time
import logging
from pathlib import Path
from fastapi import APIRouter

from backend import database as db
from backend.state import app_state
from backend.services.ws_manager import manager
from backend.services.replay_engine import replay_engine

log = logging.getLogger(__name__)
router = APIRouter()

_MITRE_PATH = Path(__file__).parent.parent / "data" / "mitre_techniques.json"
_mitre_data: dict = {}


def _load_mitre():
    global _mitre_data
    if _MITRE_PATH.exists():
        _mitre_data = json.loads(_MITRE_PATH.read_text())


_load_mitre()


@router.get("/api/status")
async def get_status():
    return {
        "feed_state": app_state.feed_state,
        "monitoring_active": app_state.monitoring_active,
        "input_mode": app_state.input_mode,
        "uptime_seconds": time.monotonic() - app_state.start_time,
        "ws_clients": manager.count,
        "replay_active": replay_engine.is_active,
        "version": "1.0.0",
    }


@router.get("/api/mitre")
async def get_mitre_coverage():
    """
    Returns live MITRE ATT&CK coverage based on actual events in the DB.
    Each technique tile has a state: untested / exploited / mitigated.
    """
    # Get distinct technique IDs from event store
    events, _ = await db.get_events_paginated(page=1, page_size=2000)
    seen_techniques: set[str] = set()
    for ev in events:
        if ev.get("technique_id"):
            seen_techniques.add(ev["technique_id"])

    # Get techniques that have playbooks (= mitigated)
    events_with_playbooks, _ = await db.get_events_paginated(
        page=1, page_size=1000, playbook_generated=True
    )
    mitigated: set[str] = set()
    for ev in events_with_playbooks:
        if ev.get("technique_id"):
            mitigated.add(ev["technique_id"])

    # Build response grouped by tactic
    tactics: dict[str, list] = {}
    for tech_id, info in _mitre_data.items():
        tactic = info["tactic"]
        if tactic not in tactics:
            tactics[tactic] = []

        if tech_id in mitigated:
            state = "mitigated"
        elif tech_id in seen_techniques:
            state = "exploited"
        else:
            state = "untested"

        tactics[tactic].append({
            "technique_id": tech_id,
            "name": info["name"],
            "tactic": tactic,
            "state": state,
        })

    return {"tactics": tactics, "seen_count": len(seen_techniques), "mitigated_count": len(mitigated)}
