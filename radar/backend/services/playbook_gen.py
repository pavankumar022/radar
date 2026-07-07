"""
RADAR — AI Playbook Generation Service
Thin provider abstraction: Gemini (primary) ↔ Claude (fallback) ↔ Mock (offline).
Swapping providers is a one-line config change, not a rewrite.
"""
import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Optional

from backend.config import settings

log = logging.getLogger(__name__)


# ─── Prompt Builder ───────────────────────────────────────────────────────────

def _build_prompt(event: dict) -> str:
    return f"""You are a senior SOC analyst. Generate a structured Incident Response playbook for the following security alert.

ALERT DETAILS:
- Event Type: {event.get("event_type", "UNKNOWN")}
- Severity: {event.get("severity", "unknown").upper()}
- Source IP: {event.get("source_ip", "unknown")}
- Destination: {event.get("destination_ip", "unknown")}
- MITRE Technique: {event.get("technique_id", "unknown")} — {event.get("tactic", "unknown")}
- Description: {event.get("description", "No description")}
- Timestamp: {event.get("timestamp", "unknown")}

Respond ONLY with valid JSON in this exact structure (no markdown, no extra text):
{{
  "situation_summary": "2-3 sentence description of what happened and the likely threat actor intent",
  "likely_technique": "Full MITRE technique name and ID, e.g. Brute Force (T1110)",
  "containment_steps": [
    "Step 1: specific actionable step",
    "Step 2: specific actionable step",
    "Step 3: specific actionable step"
  ],
  "remediation_commands": "Relevant CLI commands or configuration changes, e.g. iptables -A OUTPUT -d <ip> -j DROP\\nnet user <username> /active:no"
}}

Be specific, technical, and actionable. Reference the actual IP addresses and technique IDs from the alert."""


# ─── Gemini Provider ──────────────────────────────────────────────────────────

async def _generate_gemini(prompt: str) -> dict:
    import google.generativeai as genai
    genai.configure(api_key=settings.gemini_api_key)
    model = genai.GenerativeModel(
        model_name="gemini-2.0-flash-exp",
        generation_config={
            "temperature": 0.3,
            "max_output_tokens": 1024,
            "response_mime_type": "application/json",
        },
    )
    response = model.generate_content(prompt)
    raw = response.text.strip()
    # Strip markdown fences if present
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    return json.loads(raw), response.text


# ─── Claude Provider ──────────────────────────────────────────────────────────

async def _generate_claude(prompt: str) -> tuple[dict, str]:
    import anthropic
    client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
    message = client.messages.create(
        model="claude-3-5-haiku-20241022",
        max_tokens=1024,
        messages=[{"role": "user", "content": prompt}],
    )
    raw = message.content[0].text.strip()
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    return json.loads(raw), message.content[0].text


# ─── Mock Provider (offline/demo fallback) ────────────────────────────────────

async def _generate_mock(event: dict) -> tuple[dict, str]:
    result = {
        "situation_summary": (
            f"A {event.get('severity', 'unknown')}-severity {event.get('event_type', 'security event')} "
            f"was detected from {event.get('source_ip', 'unknown')} targeting "
            f"{event.get('destination_ip', 'internal systems')}. "
            f"This matches MITRE technique {event.get('technique_id', 'unknown')} ({event.get('tactic', 'unknown')}). "
            "Immediate containment is recommended."
        ),
        "likely_technique": f"{event.get('tactic', 'Unknown')} — {event.get('technique_id', 'T????')}",
        "containment_steps": [
            f"Isolate source IP {event.get('source_ip', 'unknown')} at perimeter firewall",
            f"Revoke active sessions from {event.get('source_ip', 'unknown')} on all authentication systems",
            "Review logs for lateral movement from the implicated host in the last 72 hours",
            "Notify incident response team and open formal incident ticket",
        ],
        "remediation_commands": (
            f"# Block source IP\niptables -A INPUT -s {event.get('source_ip', '0.0.0.0')} -j DROP\n"
            f"iptables -A OUTPUT -d {event.get('source_ip', '0.0.0.0')} -j DROP\n\n"
            "# Check for persistence mechanisms\nauditctl -l | grep -i suspicious\nsystemctl list-units --type=service --state=running"
        ),
    }
    return result, "MOCK_PROVIDER"


# ─── Public Interface ─────────────────────────────────────────────────────────

async def generate_playbook(event: dict, provider: Optional[str] = None) -> dict:
    """
    Generate an AI IR playbook for a given security event.
    Provider priority: explicit arg → config default → fallback chain.
    Never throws — returns mock playbook on any failure.
    """
    resolved_provider = provider or settings.effective_ai_provider
    prompt = _build_prompt(event)
    raw_text = ""

    try:
        if resolved_provider == "gemini" and settings.has_gemini:
            parsed, raw_text = await _generate_gemini(prompt)
            actual_provider = "gemini"
        elif resolved_provider == "claude" and settings.has_anthropic:
            parsed, raw_text = await _generate_claude(prompt)
            actual_provider = "claude"
        else:
            parsed, raw_text = await _generate_mock(event)
            actual_provider = "mock"
    except Exception as e:
        log.warning(f"AI provider '{resolved_provider}' failed: {e}. Falling back to mock.")
        parsed, raw_text = await _generate_mock(event)
        actual_provider = "mock"

    return {
        "id": str(uuid.uuid4()),
        "alert_id": event.get("id", ""),
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "provider": actual_provider,
        "situation_summary": parsed.get("situation_summary", ""),
        "likely_technique": parsed.get("likely_technique", ""),
        "technique_id": event.get("technique_id"),
        "containment_steps": parsed.get("containment_steps", []),
        "remediation_commands": parsed.get("remediation_commands", ""),
        "raw_response": raw_text,
    }
