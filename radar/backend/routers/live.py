"""
RADAR — Live Network Capture Router
POST /api/live/start  — Starts live packet capture subprocess
POST /api/live/stop   — Stops live capture process
GET  /api/live/status — Returns live capture status and statistics
POST /api/live/ingest — Ingests real network capture alerts
"""
import asyncio
import json
import logging
import os
import signal
import subprocess as _subprocess
import sys as _sys
import time
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, Request

from backend import database as db
from backend.services import geolocation
from backend.routers.alerts import broadcast_event
from backend.state import app_state

log = logging.getLogger(__name__)
router = APIRouter(prefix="/api/live")

# Global subprocess reference
_live_capture_process: Optional[_subprocess.Popen] = None
_live_alerts_memory: list[dict] = []


@router.post("/start")
async def start_live_capture():
    global _live_capture_process

    # Check if process is already running
    if _live_capture_process and _live_capture_process.poll() is None:
        return {
            "status": "already_running",
            "pid": _live_capture_process.pid,
            "message": "Live capture is already running."
        }

    # Locate live_capture.py
    backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    live_script = os.path.join(backend_dir, "live_capture.py")

    if not os.path.exists(live_script):
        raise HTTPException(status_code=500, detail="live_capture.py script not found.")

    try:
        # Launch live_capture.py as subprocess using current python interpreter
        _live_capture_process = _subprocess.Popen(
            [_sys.executable, live_script],
            stdout=_subprocess.PIPE,
            stderr=_subprocess.PIPE,
            cwd=backend_dir
        )

        app_state.input_mode = "target_ip"
        app_state.feed_state = "LIVE_FEED_ACTIVE"

        log.info(f"Live capture started with PID: {_live_capture_process.pid}")
        return {
            "status": "started",
            "pid": _live_capture_process.pid,
            "message": "Live network capture active. Monitoring ports 22, 80, 443, 3389, 8080, 445"
        }
    except Exception as e:
        log.error(f"Failed to launch live capture process: {e}")
        return {"status": "error", "message": str(e)}


@router.post("/stop")
async def stop_live_capture():
    global _live_capture_process

    if not _live_capture_process or _live_capture_process.poll() is not None:
        _live_capture_process = None
        return {"status": "not_running", "message": "Live capture was not active."}

    pid = _live_capture_process.pid
    try:
        _live_capture_process.terminate()
        try:
            _live_capture_process.wait(timeout=3)
        except _subprocess.TimeoutExpired:
            _live_capture_process.kill()
    except Exception as e:
        log.warning(f"Error terminating live capture PID {pid}: {e}")

    _live_capture_process = None
    return {"status": "stopped", "pid": pid, "message": "Live network capture stopped."}


@router.get("/status")
def live_capture_status():
    global _live_capture_process
    running = bool(_live_capture_process and _live_capture_process.poll() is None)
    return {
        "is_running": running,
        "pid": _live_capture_process.pid if running else None,
        "live_alerts": len(_live_alerts_memory),
        "last_alert": _live_alerts_memory[-1] if _live_alerts_memory else None
    }


@router.post("/ingest")
async def ingest_live_alert(request: Request):
    """
    Ingest real live packet/security alert (dict or list format),
    enrich with MITRE tactics + Geolocation, persist to DB, and broadcast to WS.
    """
    global _live_alerts_memory

    try:
        data = await request.json()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid JSON payload: {e}")

    if isinstance(data, list):
        items = [x for x in data if isinstance(x, dict)]
    elif isinstance(data, dict):
        items = [data]
    else:
        items = []

    if not items:
        return {"status": "ignored", "reason": "empty payload"}

    last_event_id = None
    for payload in items:
        src_ip = str(payload.get("src_ip") or payload.get("source_ip") or "185.22.45.10")
        dst_ip = str(payload.get("dst_ip") or payload.get("destination_ip") or "10.0.0.1")

        # Smart classification from payload fields
        status_code = payload.get("status_code")
        endpoint = str(payload.get("endpoint") or payload.get("uri") or "")
        method = str(payload.get("method") or "POST")

        event_type = payload.get("event_type")
        severity = str(payload.get("severity") or "").lower()
        technique_id = payload.get("technique_id")

        if not event_type:
            if status_code == 401 or "login" in endpoint.lower() or "auth" in endpoint.lower():
                event_type = "HTTP_BRUTE_FORCE"
                technique_id = technique_id or "T1110"
                severity = severity or "critical"
                desc = f"Failed HTTP {method} authentication attempt (Status {status_code}) on {endpoint} from {src_ip}"
            else:
                event_type = "LIVE_NETWORK_PROBE"
                technique_id = technique_id or "T1046"
                severity = severity or "warning"
                desc = payload.get("description") or f"Real live network probe captured from {src_ip}"
        else:
            event_type = str(event_type).upper()
            desc = payload.get("description") or f"Live security event from {src_ip}"

        tactic_map = {
            "T1046": "Reconnaissance",
            "T1110": "Credential Access",
            "T1190": "Initial Access",
            "T1021.001": "Lateral Movement",
            "T1210": "Lateral Movement",
        }
        tactic = tactic_map.get(technique_id, "Credential Access" if technique_id == "T1110" else "Network Capture")

        event = {
            "id": payload.get("id") or str(payload.get("uuid") or f"live-{time.time_ns()}"),
            "timestamp": payload.get("timestamp") or datetime.now(timezone.utc).isoformat(),
            "source_ip": src_ip,
            "destination_ip": dst_ip,
            "event_type": event_type,
            "severity": severity if severity in ("critical", "warning", "info") else "critical",
            "technique_id": technique_id,
            "tactic": tactic,
            "description": desc,
            "raw_payload": payload,
            "playbook_generated": False,
            "source": "live_capture",
            "lat": None, "lon": None, "country": None, "city": None,
        }

        # Enrich with Geolocation
        if src_ip and not any(src_ip.startswith(p) for p in ("10.", "192.168.", "172.16.", "127.")):
            geo = await geolocation.lookup(src_ip)
            event["lat"] = geo.get("lat")
            event["lon"] = geo.get("lon")
            event["country"] = geo.get("country")
            event["city"] = geo.get("city")

        # Check country code in payload if lat/lon missing
        if not event.get("lat") or not event.get("lon"):
            country_code = str(payload.get("geolocation") or payload.get("country") or "").upper().strip()
            if country_code in geolocation.COUNTRY_COORDINATES:
                geo_info = geolocation.COUNTRY_COORDINATES[country_code]
                event["lat"] = geo_info["lat"]
                event["lon"] = geo_info["lon"]
                event["country"] = geo_info["country"]
                event["city"] = geo_info["city"]

        # If coordinates are missing, set fallback geo node for map rendering
        if not event.get("lat") or not event.get("lon"):
            import random
            from backend.routers.logs import FALLBACK_GEO_NODES
            fallback = random.choice(FALLBACK_GEO_NODES)
            event["lat"] = fallback["lat"]
            event["lon"] = fallback["lon"]
            event["country"] = payload.get("geolocation") or fallback.get("country", "Russia")
            event["city"] = fallback.get("city", "Moscow")

        # Store memory & DB
        _live_alerts_memory.append(event)
        if len(_live_alerts_memory) > 500:
            _live_alerts_memory = _live_alerts_memory[-500:]

        await db.insert_event(event)
        await broadcast_event(event)
        last_event_id = event["id"]

    return {"status": "accepted", "events_processed": len(items), "last_event_id": last_event_id}
