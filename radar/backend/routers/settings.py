"""
RADAR — Settings Router
GET  /api/settings — returns current system settings
POST /api/settings — updates settings (live, no restart required)
POST /api/settings/shield — toggle monitoring on/off (Deploy Shield)
"""
import logging
from fastapi import APIRouter

from backend import database as db
from backend.state import app_state
from backend.services.ws_manager import manager

log = logging.getLogger(__name__)
router = APIRouter(prefix="/api/settings")


@router.get("")
async def get_settings():
    """
    Returns current system settings.
    Offline-safe: if DB is unreachable, returns hardcoded defaults
    rather than hanging or erroring.
    """
    try:
        return await db.get_settings()
    except Exception as e:
        log.warning(f"Settings DB read failed, returning defaults: {e}")
        return _default_settings()


@router.post("")
async def update_settings(body: dict):
    """Live-update settings. Applies immediately; no restart needed."""
    try:
        # Merge with existing settings
        current = await db.get_settings()
        _deep_merge(current, body)
        await db.save_settings(current)

        # Apply AI provider change to runtime config
        if "ai_provider" in body:
            from backend.config import settings as cfg
            # Validate — only update if recognized
            if body["ai_provider"] in ("gemini", "claude", "mock"):
                cfg.ai_provider = body["ai_provider"]

        # Apply monitored_ips change
        if "monitored_ips" in body and isinstance(body["monitored_ips"], list):
            app_state.monitored_ips = body["monitored_ips"]

        # Apply input_mode change
        if "input_mode" in body:
            app_state.input_mode = body["input_mode"]

        # Apply feed_state based on mode & monitored_ips
        if not app_state.monitoring_active:
            app_state.feed_state = "SYSTEM_STANDBY"
        elif app_state.input_mode == "synthetic":
            app_state.feed_state = "SYNTHETIC_FEED"
        elif app_state.input_mode == "target_ip":
            app_state.feed_state = "LIVE_FEED_ACTIVE"
        elif app_state.input_mode == "upload":
            app_state.feed_state = "LIVE_FEED_ACTIVE"

        # Apply synthetic_delay change
        if "synthetic_delay" in body:
            app_state.synthetic_delay = float(body["synthetic_delay"])

        # Broadcast updated status
        await manager.broadcast({
            "type": "status",
            "payload": {
                "feed_state": app_state.feed_state,
                "monitoring_active": app_state.monitoring_active,
                "input_mode": app_state.input_mode,
                "settings_updated": True,
            },
        })

        return {"status": "saved", "settings": current}
    except Exception as e:
        log.error(f"Settings save failed: {e}")
        return {"status": "error", "message": str(e)}


@router.post("/shield")
async def toggle_shield(body: dict):
    """
    Deploy Shield toggle — start/stop live monitoring pipeline.
    Body: {"monitoring_active": true|false}
    """
    active = body.get("monitoring_active", not app_state.monitoring_active)
    app_state.monitoring_active = active

    if active:
        app_state.feed_state = "SYNTHETIC_FEED" if app_state.input_mode == "synthetic" else "LIVE_FEED_ACTIVE"
        # Restart generator if it was stopped
        _maybe_restart_generator()
    else:
        app_state.feed_state = "SYSTEM_STANDBY"
        # Stop generator
        _maybe_stop_generator()

    # Persist
    try:
        current = await db.get_settings()
        current["monitoring_active"] = active
        await db.save_settings(current)
    except Exception:
        pass

    await manager.broadcast({
        "type": "status",
        "payload": {
            "feed_state": app_state.feed_state,
            "monitoring_active": app_state.monitoring_active,
            "input_mode": app_state.input_mode,
        },
    })

    return {"monitoring_active": active, "feed_state": app_state.feed_state}


# ─── Helpers ───────────────────────────────────────────────────────────────────

def _default_settings() -> dict:
    return {
        "detection_thresholds": {
            "general_sensitivity": 74,
            "anomaly_detection": 88,
            "lateral_movement": 42,
        },
        "ip_whitelist": [],
        "monitored_ips": [],
        "synthetic_delay": 3.0,
        "input_mode": "synthetic",
        "ai_provider": "gemini",
        "monitoring_active": True,
    }


def _deep_merge(base: dict, updates: dict) -> None:
    for key, value in updates.items():
        if key in base and isinstance(base[key], dict) and isinstance(value, dict):
            _deep_merge(base[key], value)
        else:
            base[key] = value


def _maybe_restart_generator():
    """Restart the synthetic event generator if it's not running."""
    import asyncio
    from backend.state import app_state
    if app_state.generator_task is None or app_state.generator_task.done():
        from backend.main import start_event_generator
        loop = asyncio.get_event_loop()
        app_state.generator_task = loop.create_task(start_event_generator())


def _maybe_stop_generator():
    """Stop the synthetic event generator."""
    from backend.state import app_state
    if app_state.generator_task and not app_state.generator_task.done():
        app_state.generator_task.cancel()
        app_state.generator_task = None
