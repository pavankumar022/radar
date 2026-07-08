

https://github.com/user-attachments/assets/f5d8e715-cde9-4dc3-a40d-db092343823a



<div align="center">

# 🛰️ RADAR — Real-time Autonomous Defense And Response
### *Enterprise-Grade Real-Time Cyber Threat Intelligence, Live Packet Capture & Autonomous Incident Response Platform*

[![Python](https://img.shields.io/badge/Python-3.11+-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-18.0+-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev)
[![Three.js](https://img.shields.io/badge/Three.js-3D_Globe-000000?style=for-the-badge&logo=three.js&logoColor=white)](https://threejs.org)
[![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-3.0+-38BDF8?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com)
[![MITRE ATT&CK](https://img.shields.io/badge/MITRE-ATT%26CK_v14-RED?style=for-the-badge&logo=mitre&logoColor=white)](https://attack.mitre.org)
[![License](https://img.shields.io/badge/License-MIT-green.svg?style=for-the-badge)](LICENSE)

---

```
  ██████╗  █████╗ ██████╗  █████╗ ██████╗ 
  ██╔══██╗██╔══██╗██╔══██╗██╔══██╗██╔══██╗
  ██████╔╝███████║██║  ██║███████║██████╔╝
  ██╔══██╗██╔══██║██║  ██║██╔══██║██╔══██╗
  ██║  ██║██║  ██║██████╔╝██║  ██║██║  ██║
  ╚═╝  ╚═╝╚═╝  ╚═╝╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝
  Real-time Autonomous Defense And Response
```

</div>

---

## ⚡ Overview

**RADAR** is an autonomous cybersecurity Operations Center (SOC) platform engineered to detect, visualize, and remediate network cyber threats in real time. Combining **live network packet sniffing**, **interactive 3D threat intelligence visualization**, and **autonomous MITRE ATT&CK incident playbook generation**, RADAR bridges the gap between raw network telemetry and instant security response.

---

## 🌟 Key Features

### 🌍 1. Interactive 3D Threat Intelligence Globe
- **360° Full Spatial Control**: Fully rotatable spherical Earth rendered using **Three.js** and **OrbitControls** with smooth inertia damping.
- **Exact IP Geolocation (Zero Synthetic Coordinates)**: Incoming threat vectors are mapped to their exact latitude and longitude via real-time IP Geolocation API lookups.
- **Dynamic 3D Threat Arcs**: Quadratic 3D Bezier curves connect origin attacker IPs to target protected SOC nodes, featuring animated traveling energy pulses.
- **Raycaster Inspection**: Interactive hover/click inspection tooltips displaying attacker IP, city, country, event type, and MITRE Technique IDs.

### 🛡️ 2. Automated Live Packet Capture Engine
- **Always-On Live Sniffer**: Automatically captures raw TCP SYN probes, Nmap port scans, SSH/RDP brute force attempts, and web exploit payloads on critical ports (`22`, `80`, `443`, `3389`, `445`, `8080`).
- **Zero Configuration**: Starts seamlessly alongside the FastAPI backend process with zero manual steps required.
- **Real-Time Classification**: Automatically tags live events with **`⚡ LIVE CAPTURE`** badges across WebSocket alert streams.

### 🧠 3. Autonomous MITRE ATT&CK Incident Playbooks
- **MITRE Technique Mapping**: Automatic correlation to standard ATT&CK matrix techniques (e.g., `T1046 Network Service Discovery`, `T1110 Brute Force`, `T1190 Exploit Public-Facing Application`).
- **Instant Response Playbooks**: Autonomous generation of step-by-step Containment, Eradication, and Recovery Playbooks for Critical and High severity incidents.

### 📊 4. Full-Featured SOC Dashboard
- **Live WebSocket Feed**: Real-time event streaming without page refreshes.
- **Threat Filter Controls**: Filter alerts by severity (`Critical`, `Warning`, `Info`), source (`Synthetic`, `Target IP`, `Live Capture`), or MITRE technique.
- **System Health & Replay Engine**: Built-in event replay engine to simulate enterprise-scale SOC workloads (up to 500+ EPS).

---

## 🏗️ Architecture

```
+------------------------------------+      +-----------------------------------+
| Attacker / Nmap Scanner / Payload  | ---> |   Live Network Capture Engine     |
+------------------------------------+      +-----------------------------------+
                                                          |
                                                          v
                                            +-----------------------------------+
                                            |   FastAPI Backend Ingestion       |
                                            +-----------------------------------+
                                              /             |             \
                                             v              v              v
                                      +------------+ +-------------+ +------------+
                                      | IP Geo API | | MITRE Engine| | SQLite DB  |
                                      +------------+ +-------------+ +------------+
                                                            |
                                                            v
                                            +-----------------------------------+
                                            |   WebSocket Event Stream         |
                                            +-----------------------------------+
                                                            |
                                                            v
                                            +-----------------------------------+
                                            |  Three.js Interactive 3D Globe    |
                                            |   & React SOC Dashboard           |
                                            +-----------------------------------+
```

---

## 🚀 Quickstart Guide

> [!IMPORTANT]
> **Docker & Container Deployment Limitations:**
> This platform utilizes raw network socket listening and packet sniffing to monitor traffic on security-sensitive ports (e.g. SSH 22, HTTP 80, SMB 445). These raw packet captures require direct administrative access to the host's physical network adapters. Because container runtimes (like Docker) virtualize and restrict network interface access, live packet capture will not function inside Docker. Therefore, **running the application directly on localhost (bare-metal) is required**.

### 📋 Prerequisites
- **Python**: `3.10` or higher
- **Node.js**: `18.0` or higher
- **npm**: `9.0` or higher

---

### 1️⃣ Clone the Repository & Configure Environment

```bash
# Clone the repository
git clone https://github.com/pavankumar022/radar.git
cd radar

# Navigate to application root
cd radar

# Copy environment variables file
# Windows (PowerShell):
Copy-Item .env.example .env
# Linux / macOS:
cp .env.example .env
```

Open `.env` in a text editor to add your **Gemini API key** and customize ports if needed.
The app works out-of-the-box with default settings (no key required for synthetic mode).

---

### 2️⃣ Backend Setup

```bash
# Create virtual environment
python -m venv .venv

# Activate virtual environment
# Windows (PowerShell):
.venv\Scripts\activate
# Linux / macOS:
source .venv/bin/activate

# Install Python dependencies
pip install -r backend/requirements.txt

# Start FastAPI backend (with hot-reload for development)
# Windows (PowerShell) — use the venv python directly:
.venv\Scripts\python.exe -m uvicorn backend.main:app --host 0.0.0.0 --port 8080 --reload
# Linux / macOS:
uvicorn backend.main:app --host 0.0.0.0 --port 8080 --reload
```

> [!TIP]
> On the first startup, the server automatically initializes SQLite (`radar.db`) and seeds it with synthetic security events.
> Live packet capture also starts automatically alongside the server — no extra steps required.

Backend API docs available at: **`http://localhost:8080/api/docs`**

---

### 3️⃣ Frontend Setup

Open a **new terminal window**:

```bash
# Navigate to frontend directory
cd radar/frontend

# Install Node dependencies (only needed once)
npm install

# Start Vite dev server
npm run dev
```

Open your browser at: **`http://localhost:5173`**

---

### ✅ You're Running!

| Service | URL |
|---------|-----|
| 🖥️ Frontend Dashboard | http://localhost:5173 |
| ⚙️ Backend API | http://localhost:8080 |
| 📖 Swagger Docs | http://localhost:8080/api/docs |

---

## 💣 Testing Real Security Attacks

RADAR comes bundled with runnable attack simulation tools in `radar/attack_tools/` to test live detection:

### 🎯 1. Nmap Port Scan Simulation
```bash
python attack_tools/run_nmap_scan.py --target 192.168.1.5
```
Triggers real-time **`NMAP_PORT_SCAN (T1046)`** alerts on the 3D Globe and Live Alert Feed.

### 🔑 2. SSH Brute Force Simulation
```bash
python attack_tools/run_ssh_brute.py --target 192.168.1.5
```
Triggers **`SSH_BRUTE_FORCE (T1110)`** critical alerts and generates an Incident Response Playbook.

---

## 📡 API Reference

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/api/live/start` | `POST` | Starts the live packet capture process |
| `/api/live/stop` | `POST` | Stops the live packet capture process |
| `/api/live/status` | `GET` | Returns capture status, PID, and live alert counters |
| `/api/live/ingest` | `POST` | Ingests custom network alerts (JSON dict or list) |
| `/ingest` | `POST` | Ingestion alias for custom attack tools |
| `/api/alerts/latest` | `GET` | Fetches recent security alerts |
| `/api/mitre` | `GET` | Returns MITRE ATT&CK matrix statistics |

---

## 💻 Tech Stack

- **Frontend**: React 18, Vite, Three.js (WebGL), TailwindCSS, Lucide Icons, Recharts
- **Backend**: Python 3.11, FastAPI, Uvicorn, Asyncio, WebSockets
- **Database**: SQLite (WAL mode) + In-memory L1 cache
- **Network Capture**: Python Socket Listener / Raw Packet Parsing

---

## 📝 Changelog

### v1.1.0 — Bug Fixes & Stability
- **Fix: Generate Report no longer resets on new events** — The `Incidents` page `useEffect` previously depended on `state.alerts`, causing it to re-run (and call `setReport(null)`) every time a new WebSocket event arrived. Fixed by tracking initialised alert IDs via a `useRef` so the effect only fires on actual URL navigation, not on incoming events. A second lightweight effect keeps the selected alert data fresh without touching report or playbook state.

---

## 🛡️ License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.

