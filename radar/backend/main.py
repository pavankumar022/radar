"""
RADAR — FastAPI Application Entry Point
Mounts all routers, handles startup/shutdown lifecycle.
WebSocket endpoint + REST API on port 8000.
"""
import asyncio
import logging
import time

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.config import settings
from backend import database as db
from backend.state import app_state
from backend.routers import alerts, logs, playbook, settings as settings_router, replay, status, live

logging.basicConfig(
    level=getattr(logging, settings.log_level.upper(), logging.INFO),
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
log = logging.getLogger(__name__)

# ─── App ──────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="RADAR — Real-time Autonomous Defense And Response",
    description="Autonomous cybersecurity SOC platform API",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
)

# CORS — allow frontend dev server and production Vercel frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Routers ──────────────────────────────────────────────────────────────────

app.include_router(alerts.router)
app.include_router(logs.router)
app.include_router(playbook.router)
app.include_router(settings_router.router)
app.include_router(replay.router)
app.include_router(status.router)
app.include_router(live.router)

# Direct root endpoint alias for custom ingestion scripts
from backend.routers.live import ingest_live_alert
app.post("/ingest")(ingest_live_alert)


# ─── Startup ──────────────────────────────────────────────────────────────────

@app.on_event("startup")
async def on_startup():
    log.info("RADAR backend starting up...")

    # Initialize DB schema
    await db.init_db()

    # Seed events if archive is empty
    await _seed_if_empty()

    # Load initial settings
    try:
        current_settings = await db.get_settings()
        app_state.synthetic_delay = float(current_settings.get("synthetic_delay", 3.0))
        app_state.input_mode = current_settings.get("input_mode", "synthetic")
        app_state.monitoring_active = bool(current_settings.get("monitoring_active", True))
        app_state.ai_enabled = bool(settings.gemini_api_key or settings.anthropic_api_key)
    except Exception as e:
        log.warning(f"Failed to load settings on startup: {e}")
        app_state.synthetic_delay = 3.0
        app_state.input_mode = "synthetic"
        app_state.monitoring_active = True
        app_state.ai_enabled = bool(settings.gemini_api_key or settings.anthropic_api_key)

    # Start synthetic event generator
    app_state.feed_state = "LOADING_SYNTHETIC"
    app_state.generator_task = asyncio.create_task(start_event_generator())

    # Auto-start live network packet capture process
    try:
        from backend.routers.live import start_live_capture
        await start_live_capture()
        log.info("Live network packet capture process started automatically")
    except Exception as e:
        log.warning(f"Auto-starting live capture failed: {e}")

    log.info(f"RADAR backend ready — docs at http://localhost:{settings.backend_port}/api/docs")


@app.on_event("shutdown")
async def on_shutdown():
    log.info("RADAR backend shutting down...")
    if app_state.generator_task and not app_state.generator_task.done():
        app_state.generator_task.cancel()

    try:
        from backend.routers.live import stop_live_capture
        await stop_live_capture()
    except Exception:
        pass

    from backend.services.replay_engine import replay_engine
    await replay_engine.stop()


# ─── Event Generator Loop ─────────────────────────────────────────────────────

async def start_event_generator():
    """
    Main synthetic event generation loop.
    Emits events organically when Shield is ON (monitoring_active=True).
    Respects monitoring_active toggle: Shield OFF = standby (no log collection), Shield ON = collecting logs.
    """
    from backend.services.event_generator import generate_events
    from backend.routers.alerts import broadcast_event

    log.info("Synthetic event generator starting...")
    if not app_state.monitoring_active:
        app_state.feed_state = "SYSTEM_STANDBY"
    elif app_state.input_mode == "synthetic":
        app_state.feed_state = "SYNTHETIC_FEED"
    else:
        app_state.feed_state = "LIVE_FEED_ACTIVE"

    try:
        async for event in generate_events():
            if not app_state.monitoring_active:
                app_state.feed_state = "SYSTEM_STANDBY"
                while not app_state.monitoring_active:
                    await asyncio.sleep(1.0)
                app_state.feed_state = "SYNTHETIC_FEED" if app_state.input_mode == "synthetic" else "LIVE_FEED_ACTIVE"

            if app_state.input_mode != "synthetic":
                await asyncio.sleep(1.0)
                continue

            app_state.feed_state = "SYNTHETIC_FEED"

            await broadcast_event(event)

    except asyncio.CancelledError:
        log.info("Event generator cancelled")
    except Exception as e:
        log.error(f"Event generator error: {e}", exc_info=True)
        app_state.feed_state = "SYSTEM_STANDBY"


# ─── Seed ─────────────────────────────────────────────────────────────────────

async def _seed_if_empty():
    """Default log seeding is disabled. Starts with clean empty log database."""
    log.info("Database initialized — automatic 5,000 log seeding disabled")


# ─── Health Check ─────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {
        "status": "ok",
        "uptime_seconds": time.monotonic() - app_state.start_time,
        "feed_state": app_state.feed_state,
    }


# ─── SPA Static Files Ingestion & Routing Fallback ────────────────────────────
import os
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

dist_path = os.path.join(os.path.dirname(__file__), "dist")
if os.path.exists(dist_path):
    assets_dir = os.path.join(dist_path, "assets")
    if os.path.exists(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="static")

    @app.get("/{catchall:path}")
    async def serve_spa(catchall: str):
        if catchall.startswith("api") or catchall.startswith("ws") or catchall.startswith("docs"):
            from fastapi import HTTPException
            raise HTTPException(status_code=404, detail="Not Found")
            
        file_path = os.path.join(dist_path, catchall)
        if os.path.exists(file_path) and os.path.isfile(file_path):
            return FileResponse(file_path)
            
        index_file = os.path.join(dist_path, "index.html")
        if os.path.exists(index_file):
            return FileResponse(index_file)

