# Tech Stack: R.A.D.A.R.
### **R**eal-time **A**utonomous **D**efense **A**nd **R**esponse

**Status:** Draft v2.0 — aligned with PRD_RADAR.md

---

## 1. Guiding Principles

- **Real-time first** — WebSocket over polling wherever the UI needs live data; polling is a fallback, not the default
- **Ingestion-agnostic** — the pipeline should accept synthetic, uploaded, and streamed logs through the same internal event shape, so swapping sources doesn't touch downstream code
- **Model-agnostic AI** — playbook generation and agent reasoning should sit behind a thin interface so Gemini/Claude/GPT are swappable based on latency or cost, not hardcoded
- **Fail soft, not hard** — any backend/API failure (LLM, geolocation, main server) should degrade the UI gracefully, never hang it
- **Demo-safe** — everything offensive runs in an isolated sandbox; nothing here ever targets real, unscoped infrastructure

---

## 2. Stack Overview

| Layer | Choice | Why |
|---|---|---|
| Target sandbox | OWASP Juice Shop / DVWA via Docker | Pre-built, known vulnerabilities, fully isolated |
| Red/Blue agent logic | Python + LLM API (Claude or Gemini) with tool/function calling | Fast to wire up, strong reasoning for dynamic attack-path selection |
| Backend/orchestrator | FastAPI (Python) | Native WebSocket support, async-friendly, quick to stand up REST + streaming endpoints together |
| Real-time transport | WebSocket (FastAPI native) | Required for the live alert feed — polling would feel laggy and undercut the "real-time" pitch |
| Log ingestion (upload) | FastAPI file upload endpoint, JSON/NDJSON parser | NDJSON is the standard shape for log-shipper output; parse line-by-line to handle large files without loading everything into memory |
| Log ingestion (stream) | HTTP endpoint compatible with Filebeat's HTTP output | Lets RADAR sit downstream of a real logging pipeline, not just a fixed demo target |
| Geolocation | IP geolocation API (ip-api.com or ipinfo.io) + local cache | Needed to plot real attacker origins on the globe; caching avoids rate-limit issues during demo bursts |
| AI playbook generation | Gemini 2.0 Flash (primary) or Claude (fallback) | Flash is optimized for low-latency, cheap generation — good fit for "one-click" UX; Claude as a fallback/comparison option |
| 3D globe | Three.js (custom-built) | Full control over styling/animation; real coastline data embedded directly, no external map-tile dependency |
| Frontend framework | React (Vite) | Component-based, fast dev loop, easy to wire to WebSocket + REST |
| Styling | Tailwind CSS | Fast to build a consistent dark SOC-style design system |
| Charts/analytics | Recharts or D3 | Recharts for quick stat cards/trend lines; D3 if the MITRE heatmap needs custom grid rendering |
| Data store | SQLite (demo scale) → Postgres (if scaling past hackathon) | SQLite needs zero setup; swap to Postgres only if event volume or concurrent access requires it |
| Replay engine | Custom time-scaled event dispatcher (Python) | Reads a stored event set and re-emits it over WebSocket at a configurable rate — no external tool needed |
| Containerization | Docker + Docker Compose | Isolates the sandbox target from the host/network |

---

## 3. Component Detail

### 3.1 Ingestion Layer
- **Upload path:** `POST /api/logs/upload` — accepts `.json` or `.ndjson`, streamed and parsed line-by-line (avoid loading 5,000+ events into memory at once)
- **Stream path:** `POST /api/logs/stream` — accepts Filebeat's HTTP output format; normalizes incoming events into RADAR's internal event schema before they hit the same downstream pipeline as uploaded/synthetic events
- **Normalization:** all three sources (synthetic generator, upload, stream) converge into one internal event shape (`timestamp, source_ip, event_type, severity, raw_payload, technique_id`) so nothing downstream needs to know where an event came from

### 3.2 Red Agent
- Python + LLM tool-calling (same pattern as original PRD): `scan_ports`, `scan_web_vulns`, `attempt_sqli`, `attempt_default_creds`, `check_exposed_config`
- Each tool call mapped to a MITRE ATT&CK technique ID for downstream heatmap tracking

### 3.3 Blue Agent
- Baseline: rule/signature matcher against incoming event stream
- Stretch: LLM-assisted classification for "does this pattern resemble known technique X" — call out clearly in the pitch which parts are rule-based vs. LLM-assisted, since overstating this is an easy credibility hit

### 3.4 Real-Time Feed (WebSocket)
- FastAPI `WebSocket` endpoint (`/ws/alerts`) pushes normalized events to all connected dashboard clients
- Emission is deliberately paced (~10–12 alerts/sec via a server-side rate limiter), not dumped instantly, to avoid the "obviously fake" tell
- Feed-status field (`LOADING_SYNTHETIC`, `SYNTHETIC_FEED`, `LIVE_FEED_ACTIVE`, `SYSTEM_STANDBY`) is pushed as part of connection state, not hardcoded client-side

### 3.5 3D Globe
- Three.js scene: solid-shaded continents built from embedded real coastline/border coordinate data (no external map tile service dependency, so it works offline once loaded)
- Attacker IP → geolocation lookup → lat/lon → animated arc to a fixed "protected infrastructure" marker
- Geolocation results cached in-memory (or SQLite) keyed by IP, to avoid re-querying the same address repeatedly during a burst

### 3.6 AI Playbook Generator
- `POST /api/playbook/generate` — takes an alert ID, pulls its normalized event + technique mapping, prompts the LLM for a structured IR playbook (situation summary, likely technique, containment steps, remediation)
- Thin provider abstraction (`generate_playbook(alert, provider="gemini")`) so swapping Gemini ↔ Claude is a one-line change, not a rewrite

### 3.7 MITRE ATT&CK Matrix
- Static JSON mapping of technique ID → tactic column (Initial Access, Execution, Persistence, Discovery, Defense Evasion)
- Tile state derived live from Blue Agent + real ingested event technique tags

### 3.8 Analytics Dashboard
- Aggregation queries (or in-memory counters for demo scale) for total alerts, critical count, false-positive count, correlated incidents
- Recharts line/bar components for trend views

### 3.9 Log Archive
- Paginated query endpoint (`GET /api/logs?page=&filter=`) over the normalized event store
- Filters: severity, technique ID, playbook-generated status, time range
- SQLite indexing on timestamp + severity is sufficient at hackathon scale

### 3.10 Replay Mode
- Reads a stored event set (JSON array or SQLite table) and re-emits it through the same WebSocket pipeline as live events, at a configurable speed multiplier (up to ~500 events/sec)
- Reuses the ingestion normalization and WebSocket emission code — no separate code path, just a different event source

### 3.11 Settings Panel
- `GET/POST /api/settings` — detection thresholds, IP whitelist, active input mode (synthetic/upload/stream)
- **Offline fallback:** if this endpoint fails, frontend falls back to a local default config object and mock whitelist rather than blocking the settings UI from rendering

### 3.12 Deploy Shield Toggle
- Single boolean flag (`monitoring_active`) exposed via API and WebSocket state; toggling it starts/stops the ingestion → detection pipeline without restarting the server

---

## 4. Libraries & Packages (Python / Backend)

```
fastapi              # backend, REST + WebSocket
uvicorn              # ASGI server
anthropic            # Claude API client (agent + optional playbook provider)
google-generativeai  # Gemini API client (primary playbook provider)
python-nmap          # nmap wrapper for Red Agent scanning
requests             # HTTP calls for exploit scripts, geolocation API
sqlite3 (stdlib)     # data store
pydantic             # request/response models, event schema validation
python-dotenv        # env/config management, keeps API keys out of source
ndjson               # NDJSON line-by-line parsing for log upload
websockets           # WebSocket support (or rely on FastAPI's built-in)
```

## 5. Libraries & Packages (Frontend)

```
react (Vite)
tailwindcss
recharts             # analytics charts
three                # 3D globe rendering
socket.io-client or native WebSocket API
react-window or similar  # virtualized list rendering for the 5,000+ event log archive
```

## 6. External Services

| Service | Purpose | Notes |
|---|---|---|
| Gemini 2.0 Flash API | AI playbook generation | Primary — optimized for low latency |
| Claude API | AI playbook generation (fallback) / Red Agent reasoning | Use for agent tool-calling reasoning; can double as playbook fallback |
| IP geolocation API (ip-api.com / ipinfo.io) | Real attacker IP → lat/lon for the globe | Check free-tier rate limits before the live demo; cache aggressively |

---

## 7. Local Dev / Infra

```
docker + docker-compose     # sandbox target isolation
git + GitHub                # version control
.env file                   # API keys — Gemini, Claude, geolocation service (never committed)
```

**docker-compose.yml (target sandbox) — conceptual shape:**
```yaml
services:
  juice-shop:
    image: bkimminich/juice-shop
    ports:
      - "3000:3000"
    networks:
      - sandbox-net

networks:
  sandbox-net:
    driver: bridge
```

---

## 8. What We're Deliberately NOT Using (and why)

| Skipped | Reason |
|---|---|
| Kubernetes | Overkill for a single-target, demo-scale deployment |
| Real SIEM (Splunk/ELK) as the primary store | Too slow to stand up meaningfully in the build window; Filebeat compatibility gets you the *pipeline shape* without needing the full Elastic stack |
| Multi-agent orchestration frameworks (LangGraph/CrewAI) | A custom tool-calling loop is faster to build, easier to debug live, and sufficient at this scope |
| Postgres/managed DB by default | SQLite is enough at demo scale; only move up if event volume or concurrency actually requires it |
| Cloud deployment (AWS/GCP/Azure) | Local Docker removes a failure point during judging; deploy later if needed |
| Fully autonomous production remediation | Out of scope entirely — remediation is drafted by the LLM, never auto-applied outside the sandbox without review |

---

## 9. API Keys / Config Needed

- `GEMINI_API_KEY` — AI playbook generation
- `ANTHROPIC_API_KEY` — Red Agent reasoning / fallback playbook generation
- `GEO_API_KEY` — geolocation service (if the chosen provider requires one; some free tiers don't)
- No hardcoded credentials anywhere in the repo — all loaded via `.env`, matching the credential-hygiene requirement in the PRD

---

## 10. Fallback Plan (if something breaks under time pressure)

| If this breaks... | Fallback |
|---|---|
| WebSocket connection is unstable during demo | Fall back to short-interval polling (`GET /api/alerts/latest`) — keep the same event shape so the switch is invisible to the rest of the UI |
| Geolocation API rate-limited or down | Fall back to a small pre-cached table of common IP → city mappings for demo IPs |
| Gemini API latency/outage during live demo | Swap provider flag to Claude — this is why the playbook generator is built behind a thin interface |
| Filebeat streaming integration isn't ready in time | Demo log upload only; mention streaming as "built, not wired to a live shipper for this demo" — honest scoping beats a broken live integration |
| Replay mode causes UI lag at high speed | Cap the demoed replay speed lower (e.g., 100/sec) and mention 500/sec is supported but throttled for demo stability |
| Settings backend fails mid-demo | Offline fallback config kicks in automatically — this is a designed feature, not a crash |
