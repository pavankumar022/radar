"""
RADAR — Synthetic Event Generator
Produces a realistic, organically-paced stream of security events.
Rate: ~10-12 events/sec with natural variance (not perfectly uniform).
All events are properly normalized to the SecurityEvent schema.
"""
import asyncio
import json
import logging
import random
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import AsyncIterator, Callable, Awaitable

from backend import database as db
from backend.services import geolocation

log = logging.getLogger(__name__)

# ─── Event Templates ──────────────────────────────────────────────────────────

_ATTACKER_IPS = [
    "185.22.45.10", "45.122.9.201", "103.45.11.2", "92.45.1.221",
    "194.165.16.11", "62.173.142.5", "91.108.4.192", "178.62.33.195",
    "5.188.10.76", "91.240.118.172", "77.222.36.81", "194.61.24.103",
]

_INTERNAL_IPS = [
    "10.0.1.55", "10.0.4.112", "192.168.1.100", "172.16.0.55",
    "10.0.0.25", "192.168.10.50",
]

_EVENT_TEMPLATES = [
    {
        "event_type": "BRUTE_FORCE",
        "severity": "critical",
        "technique_id": "T1110",
        "description": "Multiple failed SSH authentication attempts detected. Threshold exceeded.",
        "weight": 20,
    },
    {
        "event_type": "C2_BEACON",
        "severity": "critical",
        "technique_id": "T1071.001",
        "description": "Outbound C2 beaconing to known malicious domain detected.",
        "weight": 15,
    },
    {
        "event_type": "SQL_INJECT",
        "severity": "critical",
        "technique_id": "T1190",
        "description": "SQL injection payload detected in HTTP request body.",
        "weight": 15,
    },
    {
        "event_type": "PORT_SCAN",
        "severity": "warning",
        "technique_id": "T1046",
        "description": "Systematic port scan detected from external source.",
        "weight": 25,
    },
    {
        "event_type": "PRIVILEGE_ESC",
        "severity": "critical",
        "technique_id": "T1055",
        "description": "Process injection attempt targeting privileged system process.",
        "weight": 10,
    },
    {
        "event_type": "LATERAL_MOVE",
        "severity": "warning",
        "technique_id": "T1018",
        "description": "Unusual internal network traversal pattern detected.",
        "weight": 15,
    },
    {
        "event_type": "RANSOM_SIM",
        "severity": "critical",
        "technique_id": "T1027",
        "description": "File encryption pattern consistent with ransomware activity.",
        "weight": 8,
    },
    {
        "event_type": "DATA_EXFIL",
        "severity": "critical",
        "technique_id": "T1041",
        "description": "Large volume data transfer to external IP over non-standard port.",
        "weight": 10,
    },
    {
        "event_type": "POWERSHELL_EXEC",
        "severity": "warning",
        "technique_id": "T1059.001",
        "description": "Encoded PowerShell command execution detected.",
        "weight": 20,
    },
    {
        "event_type": "CRED_DUMP",
        "severity": "critical",
        "technique_id": "T1110",
        "description": "LSASS memory access pattern consistent with credential dumping.",
        "weight": 8,
    },
    {
        "event_type": "SCHEDULED_TASK",
        "severity": "warning",
        "technique_id": "T1053.005",
        "description": "New scheduled task created by non-admin process.",
        "weight": 12,
    },
    {
        "event_type": "EXTERNAL_SCAN",
        "severity": "info",
        "technique_id": "T1595",
        "description": "External reconnaissance scan against perimeter assets.",
        "weight": 30,
    },
    {
        "event_type": "DNS_TUNNEL",
        "severity": "warning",
        "technique_id": "T1071.004",
        "description": "DNS tunneling activity detected — abnormal query pattern.",
        "weight": 10,
    },
    {
        "event_type": "LOG_CLEARED",
        "severity": "critical",
        "technique_id": "T1070.001",
        "description": "Security event logs cleared on endpoint — possible cover-up.",
        "weight": 5,
    },
]

_DEST_TARGETS = [
    "SSH_SERVER_PROD_04", "WEB_APP_PROD_01", "DB_SERVER_03",
    "AD_DOMAIN_CTRL_01", "API_GATEWAY_PROD", "BACKUP_SRV_02",
    "K8S_MASTER_NODE", "VPN_CONCENTRATOR_01",
]

# Weighted random choice
_weights = [t["weight"] for t in _EVENT_TEMPLATES]


def _make_event(source_ip: str | None = None) -> dict:
    """Generate a single synthetic event dict."""
    from backend.state import app_state
    template = random.choices(_EVENT_TEMPLATES, weights=_weights, k=1)[0]
    
    if app_state.input_mode == "target_ip" and app_state.monitored_ips:
        dst_ip = random.choice(app_state.monitored_ips)
        src_ip = source_ip or random.choice(_ATTACKER_IPS)
        description = f"{template['description']} [Target Node: {dst_ip}]"
        raw_payload = {
            "surveillance": "TARGET_IP_SURVEILLANCE",
            "target_ip": dst_ip,
            "attacker_ip": src_ip,
            "event_type": template["event_type"],
            "severity": template["severity"],
            "technique_id": template["technique_id"],
            "protocol": random.choice(["TCP/445 (SMB)", "TCP/3389 (RDP)", "TCP/22 (SSH)", "HTTP/8080", "UDP/53 (DNS)"]),
            "target_os": "Windows Server / Workstation",
            "process_name": random.choice(["powershell.exe", "svchost.exe", "lsass.exe", "cmd.exe", "nmap.exe"]),
            "signature": f"SIG-{template['event_type']}-DETECTED",
        }
    else:
        src_ip = source_ip or random.choice(_ATTACKER_IPS + _INTERNAL_IPS)
        dst_ip = random.choice(_DEST_TARGETS)
        description = template["description"]
        raw_payload = {"simulated": True, "template_weight": template["weight"]}

    return {
        "id": str(uuid.uuid4()),
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "source_ip": src_ip,
        "destination_ip": dst_ip,
        "event_type": template["event_type"],
        "severity": template["severity"],
        "technique_id": template["technique_id"],
        "tactic": None,   # filled in by generator via MITRE lookup
        "description": description,
        "raw_payload": raw_payload,
        "playbook_generated": False,
        "lat": None, "lon": None, "country": None, "city": None,
    }


# ─── MITRE lookup helper ───────────────────────────────────────────────────────

_mitre: dict = {}

def _load_mitre() -> None:
    global _mitre
    path = Path(__file__).parent.parent / "data" / "mitre_techniques.json"
    if path.exists():
        _mitre = json.loads(path.read_text())

_load_mitre()


async def _enrich_event(event: dict) -> dict:
    """Add geolocation and MITRE tactic to an event dict in-place."""
    # MITRE tactic
    tid = event.get("technique_id")
    if tid and tid in _mitre:
        event["tactic"] = _mitre[tid]["tactic"]

    # Geolocation (only for external IPs)
    src = event.get("source_ip", "")
    if src and not any(src.startswith(p) for p in ("10.", "192.168.", "172.16.", "127.")):
        geo = await geolocation.lookup(src)
        event["lat"] = geo["lat"]
        event["lon"] = geo["lon"]
        event["country"] = geo["country"]
        event["city"] = geo["city"]

    return event


# ─── Public Generator ─────────────────────────────────────────────────────────

async def generate_events(
    on_event: Callable[[dict], Awaitable[None]] | None = None,
) -> AsyncIterator[dict]:
    """
    Async generator yielding enriched events.
    Uses app_state.synthetic_delay for pacing.
    Natural variance: interval jitters ±30% to avoid uniform/fake feel.
    If on_event callback is provided, it's called after each event is yielded.
    """
    from backend.state import app_state
    while True:
        if not app_state.monitoring_active:
            await asyncio.sleep(1.0)
            continue

        # Synthetic background events MUST ONLY be generated in 'synthetic' mode.
        # Target IP, Upload, and Stream modes listen exclusively for real incoming telemetry.
        if app_state.input_mode != "synthetic":
            await asyncio.sleep(1.0)
            continue

        event = _make_event()
        event = await _enrich_event(event)

        # Persist to DB (non-blocking)
        asyncio.create_task(db.insert_event(event))

        yield event

        if on_event:
            await on_event(event)

        # Jitter: ±30% of app_state.synthetic_delay
        delay = getattr(app_state, "synthetic_delay", 3.0)
        jitter = random.uniform(0.7, 1.3)
        await asyncio.sleep(delay * jitter)


async def generate_seed_events(count: int = 5000) -> list[dict]:
    """
    Generate a batch of seed events for the log archive.
    Uses sequential timestamps going back in time.
    """
    from datetime import timedelta
    now = datetime.now(timezone.utc)
    events = []
    for i in range(count):
        ev = _make_event()
        # Spread over last 30 days
        age_seconds = random.uniform(0, 30 * 24 * 3600)
        ev["timestamp"] = (now - timedelta(seconds=age_seconds)).isoformat()
        ev = await _enrich_with_mitre_only(ev)
        events.append(ev)
    return events


async def _enrich_with_mitre_only(event: dict) -> dict:
    """Enrich with MITRE tactic only (no geolocation API call for seed data)."""
    tid = event.get("technique_id")
    if tid and tid in _mitre:
        event["tactic"] = _mitre[tid]["tactic"]
    # Use demo fallback for seed geo
    src = event.get("source_ip", "")
    fallback = geolocation._DEMO_IP_FALLBACK.get(src) or geolocation._private_fallback(src)
    if fallback:
        event["lat"] = fallback["lat"]
        event["lon"] = fallback["lon"]
        event["country"] = fallback["country"]
        event["city"] = fallback["city"]
    return event
