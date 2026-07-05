"""
RADAR — SQLite Database Layer (async via aiosqlite)
Schema: events, playbooks, settings, geo_cache
"""
import aiosqlite
import json
import logging
from datetime import datetime
from pathlib import Path
from typing import Optional
from backend.config import settings

log = logging.getLogger(__name__)

DB_PATH = settings.database_path


# ─── Schema ───────────────────────────────────────────────────────────────────

SCHEMA_SQL = """
PRAGMA journal_mode=WAL;
PRAGMA synchronous=NORMAL;

CREATE TABLE IF NOT EXISTS events (
    id              TEXT PRIMARY KEY,
    timestamp       TEXT NOT NULL,
    source_ip       TEXT NOT NULL,
    destination_ip  TEXT,
    event_type      TEXT NOT NULL,
    severity        TEXT NOT NULL CHECK (severity IN ('critical','warning','info')),
    technique_id    TEXT,
    tactic          TEXT,
    description     TEXT,
    raw_payload     TEXT,
    playbook_generated INTEGER NOT NULL DEFAULT 0,
    lat             REAL,
    lon             REAL,
    country         TEXT,
    city            TEXT
);

CREATE INDEX IF NOT EXISTS idx_events_timestamp  ON events(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_events_severity   ON events(severity);
CREATE INDEX IF NOT EXISTS idx_events_technique  ON events(technique_id);

CREATE TABLE IF NOT EXISTS playbooks (
    id              TEXT PRIMARY KEY,
    alert_id        TEXT NOT NULL,
    generated_at    TEXT NOT NULL,
    provider        TEXT NOT NULL,
    situation_summary TEXT NOT NULL,
    likely_technique  TEXT NOT NULL,
    technique_id    TEXT,
    containment_steps TEXT NOT NULL DEFAULT '[]',
    remediation_commands TEXT NOT NULL DEFAULT '',
    raw_response    TEXT
);

CREATE INDEX IF NOT EXISTS idx_playbooks_alert ON playbooks(alert_id);

CREATE TABLE IF NOT EXISTS settings (
    key     TEXT PRIMARY KEY,
    value   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS geo_cache (
    ip      TEXT PRIMARY KEY,
    lat     REAL NOT NULL,
    lon     REAL NOT NULL,
    country TEXT NOT NULL,
    city    TEXT NOT NULL,
    cached_at TEXT NOT NULL
);
"""


# ─── Connection Helper ─────────────────────────────────────────────────────────

async def get_db() -> aiosqlite.Connection:
    """Open a database connection (caller must close or use async-with)."""
    db = await aiosqlite.connect(DB_PATH)
    db.row_factory = aiosqlite.Row
    return db


# ─── Init ─────────────────────────────────────────────────────────────────────

async def init_db() -> None:
    """Create schema and seed default settings if needed."""
    log.info(f"Initializing database at {DB_PATH}")
    async with aiosqlite.connect(DB_PATH) as db:
        await db.executescript(SCHEMA_SQL)
        await db.commit()
        await _seed_default_settings(db)
    log.info("Database ready")


async def _seed_default_settings(db: aiosqlite.Connection) -> None:
    from backend.models import SystemSettings
    row = await db.execute("SELECT key FROM settings WHERE key='system' LIMIT 1")
    existing = await row.fetchone()
    if not existing:
        defaults = SystemSettings()
        await db.execute(
            "INSERT INTO settings(key, value) VALUES (?, ?)",
            ("system", defaults.model_dump_json())
        )
        await db.commit()
        log.info("Seeded default system settings")


# ─── Events ───────────────────────────────────────────────────────────────────

async def insert_event(event: dict) -> None:
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("""
            INSERT OR REPLACE INTO events
            (id, timestamp, source_ip, destination_ip, event_type, severity,
             technique_id, tactic, description, raw_payload, playbook_generated,
             lat, lon, country, city)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        """, (
            event["id"],
            event.get("timestamp", datetime.utcnow().isoformat()),
            event["source_ip"],
            event.get("destination_ip"),
            event["event_type"],
            event["severity"],
            event.get("technique_id"),
            event.get("tactic"),
            event.get("description"),
            json.dumps(event.get("raw_payload")) if event.get("raw_payload") else None,
            1 if event.get("playbook_generated") else 0,
            event.get("lat"),
            event.get("lon"),
            event.get("country"),
            event.get("city"),
        ))
        await db.commit()


async def get_events_paginated(
    page: int = 1,
    page_size: int = 50,
    severity: Optional[str] = None,
    technique_id: Optional[str] = None,
    playbook_generated: Optional[bool] = None,
    search: Optional[str] = None,
    time_from: Optional[str] = None,
    time_to: Optional[str] = None,
) -> tuple[list[dict], int]:
    conditions = []
    params: list = []

    if severity:
        conditions.append("severity = ?")
        params.append(severity)
    if technique_id:
        conditions.append("technique_id = ?")
        params.append(technique_id)
    if playbook_generated is not None:
        conditions.append("playbook_generated = ?")
        params.append(1 if playbook_generated else 0)
    if search:
        conditions.append("(source_ip LIKE ? OR event_type LIKE ? OR technique_id LIKE ? OR id LIKE ?)")
        s = f"%{search}%"
        params.extend([s, s, s, s])
    if time_from:
        conditions.append("timestamp >= ?")
        params.append(time_from)
    if time_to:
        conditions.append("timestamp <= ?")
        params.append(time_to)

    where = "WHERE " + " AND ".join(conditions) if conditions else ""
    offset = (page - 1) * page_size

    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        count_row = await db.execute(f"SELECT COUNT(*) FROM events {where}", params)
        total = (await count_row.fetchone())[0]

        rows = await db.execute(
            f"SELECT * FROM events {where} ORDER BY timestamp DESC LIMIT ? OFFSET ?",
            params + [page_size, offset]
        )
        events = [dict(row) async for row in rows]

    # Deserialize raw_payload
    for ev in events:
        if ev.get("raw_payload"):
            try:
                ev["raw_payload"] = json.loads(ev["raw_payload"])
            except Exception:
                ev["raw_payload"] = None
        ev["playbook_generated"] = bool(ev.get("playbook_generated"))

    return events, total


async def get_event_by_id(event_id: str) -> Optional[dict]:
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        row = await db.execute("SELECT * FROM events WHERE id = ?", (event_id,))
        result = await row.fetchone()
        if not result:
            return None
        ev = dict(result)
        if ev.get("raw_payload"):
            try:
                ev["raw_payload"] = json.loads(ev["raw_payload"])
            except Exception:
                ev["raw_payload"] = None
        ev["playbook_generated"] = bool(ev.get("playbook_generated"))
        return ev


async def mark_event_playbook_generated(event_id: str) -> None:
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            "UPDATE events SET playbook_generated=1 WHERE id=?", (event_id,)
        )
        await db.commit()


async def get_stats() -> dict:
    async with aiosqlite.connect(DB_PATH) as db:
        total = (await (await db.execute("SELECT COUNT(*) FROM events")).fetchone())[0]
        critical = (await (await db.execute("SELECT COUNT(*) FROM events WHERE severity='critical'")).fetchone())[0]
        false_pos = max(0, int(total * 0.10))   # ~10% false positive estimate
        correlated = max(0, int(critical * 0.33))
    return {
        "total_alerts": total,
        "critical_count": critical,
        "false_positive_count": false_pos,
        "correlated_incidents": correlated,
    }


# ─── Playbooks ────────────────────────────────────────────────────────────────

async def save_playbook(playbook: dict) -> None:
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("""
            INSERT OR REPLACE INTO playbooks
            (id, alert_id, generated_at, provider, situation_summary,
             likely_technique, technique_id, containment_steps,
             remediation_commands, raw_response)
            VALUES (?,?,?,?,?,?,?,?,?,?)
        """, (
            playbook["id"],
            playbook["alert_id"],
            playbook.get("generated_at", datetime.utcnow().isoformat()),
            playbook["provider"],
            playbook["situation_summary"],
            playbook["likely_technique"],
            playbook.get("technique_id"),
            json.dumps(playbook.get("containment_steps", [])),
            playbook.get("remediation_commands", ""),
            playbook.get("raw_response"),
        ))
        await db.commit()


async def get_playbook_by_alert(alert_id: str) -> Optional[dict]:
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        row = await db.execute(
            "SELECT * FROM playbooks WHERE alert_id=? ORDER BY generated_at DESC LIMIT 1",
            (alert_id,)
        )
        result = await row.fetchone()
        if not result:
            return None
        pb = dict(result)
        pb["containment_steps"] = json.loads(pb.get("containment_steps") or "[]")
        return pb


# ─── Settings ─────────────────────────────────────────────────────────────────

async def get_settings() -> dict:
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        row = await db.execute("SELECT value FROM settings WHERE key='system'")
        result = await row.fetchone()
        if result:
            val = json.loads(result["value"])
            if "monitored_ips" not in val:
                val["monitored_ips"] = ["10.0.1.55", "10.0.4.112", "192.168.1.100"]
            if "synthetic_delay" not in val:
                val["synthetic_delay"] = 3.0
            return val
    from backend.models import SystemSettings
    return SystemSettings().model_dump()


async def save_settings(data: dict) -> None:
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            "INSERT OR REPLACE INTO settings(key, value) VALUES (?, ?)",
            ("system", json.dumps(data))
        )
        await db.commit()


async def clear_all_events() -> None:
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("DELETE FROM events")
        await db.execute("DELETE FROM playbooks")
        await db.commit()


# ─── Geo Cache ────────────────────────────────────────────────────────────────

async def get_geo_cache(ip: str) -> Optional[dict]:
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        row = await db.execute("SELECT * FROM geo_cache WHERE ip=?", (ip,))
        result = await row.fetchone()
        return dict(result) if result else None


async def set_geo_cache(ip: str, lat: float, lon: float, country: str, city: str) -> None:
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            "INSERT OR REPLACE INTO geo_cache(ip, lat, lon, country, city, cached_at) VALUES (?,?,?,?,?,?)",
            (ip, lat, lon, country, city, datetime.utcnow().isoformat())
        )
        await db.commit()
