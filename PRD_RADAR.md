# PRD: R.A.D.A.R.
### **R**eal-time **A**utonomous **D**efense **A**nd **R**esponse

**Project type:** Hackathon build (with production-hardening roadmap)
**Status:** Draft v2.0 — supersedes prior "Red vs Blue AI Defense" naming
**Owner:** [Your team name]

---

## 0. Why the Rename

"Red vs Blue AI Defense" is a generic, overused hackathon title — many teams pitch some variant of it every cycle. **RADAR** is short, memorable, thematically apt (a system whose entire job is continuous detection), and gives judges/recruiters a clean, distinct name to remember. All references below use **RADAR** as the product name; full-form acronyms are spelled out on first use in each section.

---

## 1. Problem Statement

Enterprise security relies on periodic, manual assessments — quarterly pentests, scheduled scans — that can't keep pace with modern threats. Attackers use automated tooling that scans, discovers, and exploits newly disclosed **CVEs** (Common Vulnerabilities and Exposures) within hours of release. Defenders, meanwhile, wait for the next audit cycle.

**Core problem:** Organizations lack a continuous, autonomous system that discovers vulnerabilities, simulates real attacker behavior, detects it, and closes the gap — faster than a human audit cycle, and against **real, live log data**, not just a fixed sandbox demo.

---

## 2. Solution Overview

RADAR is a continuous **Red/Blue** autonomous security loop combined with a production-style **SOC** (Security Operations Center) dashboard. It:

1. Runs an autonomous attack → detect → remediate → re-test cycle against a sandboxed target
2. Ingests **real log data** (uploaded files or live streams) so it isn't limited to a fixed demo target
3. Visualizes live threats on an interactive 3D globe with real geolocation
4. Uses an LLM to generate **one-click incident response playbooks**
5. Tracks detection coverage against the **MITRE ATT&CK** framework (Adversarial Tactics, Techniques, and Common Knowledge)
6. Ships with the operational tooling a real SOC dashboard needs: settings, replay/stress-test mode, log archive, and a live on/off control

---

## 3. Goals & Success Criteria

### Primary goals
- Prove the full autonomous Red/Blue loop end-to-end, live, without manual triggering
- Prove the system can ingest **real external data** (uploaded logs / streamed logs), not just simulate against a fixed sandbox
- Ship a dashboard that *feels* production-grade — real-time, configurable, resilient to backend failure — not a static mockup

### Definition of Done
- [ ] Autonomous Scan → Attack → Detect → Remediate → Re-test cycle runs end-to-end against a sandboxed target
- [ ] Live **WS** (WebSocket) stream pushes alerts to the UI in real time, at a realistic ingestion pace (not instant/fake)
- [ ] 3D globe renders real attacker IP → geolocation → arc animation to a protected-asset marker
- [ ] One-click **AI IR playbook** (AI-generated Incident Response playbook) generation for Critical-severity alerts
- [ ] MITRE ATT&CK heatmap updates live across at least 5 tactics
- [ ] Log archive supports pagination and filtering across 5,000+ normalized events
- [ ] Replay mode can stress-test the dashboard at configurable speed (up to ~500 events/sec)
- [ ] Log upload (JSON/NDJSON) and streamed ingestion (Filebeat-compatible HTTP endpoint) both work
- [ ] Settings panel allows live threshold tuning, IP whitelisting, and input-mode switching without a restart
- [ ] "Deploy Shield" toggle turns live monitoring on/off from the UI
- [ ] System degrades gracefully offline (settings/backend failure does not hang the UI)

---

## 4. Feature Set (Full Spec)

### 4.1 Core Autonomous Loop (original scope, retained)

| Component | Description |
|---|---|
| **Red Agent** | LLM-driven agent with tool-calling access to scan/exploit tools; selects attack paths dynamically based on scan results, mapped to ATT&CK technique IDs |
| **Blue Agent** | Detects and scores whether Red Agent activity would be caught; upgraded from static rules toward LLM-assisted pattern classification where feasible |
| **Remediation Engine** | Generates concrete fixes (config change, detection rule, code patch/diff) for missed detections |
| **Orchestrator** | Sequences Scan → Attack → Detect → Remediate → Re-test continuously |

### 4.2 RTD — Real-Time Threat Detection
- Live **WS** stream of security alerts — brute force, **C2** (Command and Control) beaconing, exfiltration, and correlated multi-vector attacks
- Organic ingestion pacing (~10–12 alerts/sec, 6–10s update interval) — deliberately *not* instantaneous, so the feed feels real rather than scripted

### 4.3 3D Globe — Live Attack Vector Map
- Real IP → geolocation lookup (via a geolocation API/service) plotted as animated arcs from attacker origin to a protected-asset marker
- Solid-shaded continents (no wireframe/grid clutter), dense simultaneous arc traffic, drag-to-rotate / scroll-to-zoom
- Top-attack-origins leaderboard overlay

### 4.4 AI IR Playbooks — AI-Generated Incident Response Playbooks
- One-click, LLM-generated response playbook for any Critical-severity alert
- Output includes: what happened, likely technique (ATT&CK-mapped), immediate containment steps, and suggested remediation
- Model-agnostic design: works with Gemini 2.0 Flash, Claude, or GPT — pick based on cost/latency tradeoffs, not lock-in

### 4.5 MITRE ATT&CK Coverage Matrix
- Live heatmap across 5 tactics: Initial Access, Execution, Persistence, Discovery, Defense Evasion (extendable to the full matrix later)
- Tile states: untested / exploited-undetected / mitigated

### 4.6 Analytics Dashboard
- Real-time stats: total alerts, critical count, false-positive count, correlated incident count
- Trend charts for detection coverage over time

### 4.7 Log Archive
- Paginated archive of 5,000+ normalized security events
- Filterable by severity, technique, playbook status, time range

### 4.8 Replay Mode
- Replays historical/synthetic event sets at configurable speed (up to ~500 events/sec) to stress-test dashboard rendering and backend throughput
- Proves the UI doesn't fall over under real load — not just a slow, scripted demo

### 4.9 Log Ingestion — Upload + Streaming
- Manual upload: JSON / **NDJSON** (Newline-Delimited JSON) log files
- Streaming ingestion: HTTP endpoint compatible with **Filebeat** (Elastic's lightweight log shipper), so RADAR can sit downstream of a real logging pipeline
- This is the single most important feature for answering "does this work against a live environment" — it's the difference between a fixed-sandbox demo and a tool that can point at real infrastructure

### 4.10 Settings Panel
- Live tuning of detection thresholds
- IP whitelist management
- Input-mode switching (synthetic / uploaded / live stream) without restarting the app
- **Offline fallback:** if the backend is unreachable, settings gracefully fall back to local simulation config and mock values instead of hanging

### 4.11 Deploy Shield — Monitoring Toggle
- Single UI control to turn live log monitoring on/off
- Topbar reflects real system state, not a hardcoded label: `LOADING SYNTHETIC` → `SYNTHETIC FEED` → `LIVE FEED ACTIVE` → `SYSTEM STANDBY`

---

## 5. Non-Functional / Production-Polish Requirements

These are called out as their own section deliberately — they're what separates a "hackathon demo" from a "credible prototype," and should be treated as first-class requirements, not afterthoughts:

| Requirement | Why it matters |
|---|---|
| Realistic ingestion pacing, not instant/fake loading | Instant data dumps look scripted; technical reviewers notice immediately |
| Dynamic, state-driven UI indicators (not hardcoded labels) | Signals the UI actually reflects backend state rather than being a static mock |
| Graceful offline/degraded-mode handling | Real systems fail; a UI that hangs on backend failure reads as unfinished |
| No hardcoded credentials anywhere in the repo, even for demo API keys | Baseline security hygiene — this gets checked in any real review |
| Smooth page/tab transitions | Small polish detail, cheap to add, disproportionately affects perceived quality |
| Clean repository (no backup/dead directories, no commented-out cruft) | Signals the project has had a real second pass, not just a one-shot build |

---

## 6. System Architecture

```
                     ┌─────────────────────┐
   Log Upload  ────► │                     │
   (JSON/NDJSON)     │                     │
                     │   Ingestion Layer   │
   Filebeat HTTP ───►│  (upload + stream)  │
   Stream            │                     │
                     └──────────┬──────────┘
                                │
                                ▼
   ┌─────────────┐     ┌───────────────┐      ┌──────────────┐
   │  Red Agent  │────►│  Orchestrator  │◄────►│  Blue Agent  │
   │ (LLM+tools) │     │  (FastAPI)     │      │ (detection)  │
   └─────────────┘     └───────┬───────┘      └──────────────┘
                                │
                    WebSocket push (real-time)
                                │
                                ▼
                     ┌─────────────────────┐
                     │      Dashboard       │
                     │ ─ Live feed          │
                     │ ─ 3D globe           │
                     │ ─ ATT&CK matrix      │
                     │ ─ Analytics          │
                     │ ─ Log archive        │
                     │ ─ Settings           │
                     │ ─ AI playbooks (LLM) │
                     └─────────────────────┘
```

---

## 7. Tech Stack

| Layer | Choice |
|---|---|
| Red/Blue agent logic | Python, LLM API (Claude/Gemini) with tool/function calling |
| Ingestion | FastAPI endpoint accepting file upload + Filebeat-compatible HTTP stream |
| Real-time transport | WebSocket (FastAPI native) |
| Geolocation | IP geolocation API (e.g., ip-api.com, ipinfo.io) — cache results to avoid rate limits |
| AI playbook generation | Gemini 2.0 Flash (cost/latency-optimized) or Claude, swappable |
| 3D globe | Three.js (custom-built, real coastline/country outline data, no external map tiles needed) |
| Frontend | React, WebSocket client, Recharts/D3 for analytics |
| Data store | SQLite for demo scale; Postgres if scaling past hackathon |
| Replay engine | Simple time-scaled event dispatcher reading from a stored event set |

---

## 8. Safety & Guardrails (unchanged principle, restated)

- All offensive activity runs exclusively against self-hosted, isolated sandbox targets
- Red Agent restricted to known, catalogued ATT&CK-mapped techniques — no open-ended exploit generation
- AI-generated remediation is **drafted, not auto-applied to anything outside the sandbox**, without a review step
- No autonomous action outside the sandbox network boundary
- All actions logged for auditability

---

## 9. Roadmap / Build Priority

**Phase 1 — Close the credibility gap (highest priority, do first)**
1. Log upload (JSON/NDJSON) — proves it's not a fixed-sandbox-only toy
2. Realistic ingestion pacing — removes the "obviously fake demo" tell
3. Replay mode — cheap to build, high demo impact

**Phase 2 — Core loop hardening**
4. WebSocket live feed (replace polling/mock state)
5. Dynamic feed-status indicator tied to real state
6. Settings panel with offline fallback

**Phase 3 — Differentiation features**
7. 3D globe with real IP geolocation
8. AI-generated IR playbooks
9. MITRE ATT&CK live heatmap

**Phase 4 — Production polish**
10. Log archive with pagination/filtering
11. Filebeat streaming ingestion
12. Credential hygiene pass, page transitions, repo cleanup

---

## 10. Open Questions

- Which geolocation API/service — rate limits and cost at demo scale need checking before committing
- Gemini vs Claude for playbook generation — decide based on latency during live demo, not just cost
- Replay mode target throughput (500/sec) — confirm this doesn't require backend changes beyond the dispatcher
- Whether Filebeat ingestion is a "nice to have" demo mention or something you'll actually wire up and show live

---

## 11. Glossary (Acronyms Used in This Document)

| Short form | Full name |
|---|---|
| RADAR | Real-time Autonomous Defense And Response |
| CVE | Common Vulnerabilities and Exposures |
| SOC | Security Operations Center |
| WS | WebSocket |
| C2 | Command and Control |
| ATT&CK | Adversarial Tactics, Techniques, and Common Knowledge (MITRE) |
| TTP | Tactics, Techniques, and Procedures |
| IR | Incident Response |
| NDJSON | Newline-Delimited JSON |
| CVSS | Common Vulnerability Scoring System |
| KEV | Known Exploited Vulnerabilities (CISA catalog) |
