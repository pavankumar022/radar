<div align="center">

# 🛰️ RADAR — Real-time Autonomous Defense And Response
### *Enterprise-Grade Real-Time Cyber Threat Intelligence, Live Packet Capture & Autonomous Incident Response Platform*

[![Python](https://img.shields.io/badge/Python-3.11+-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-18.0+-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev)
[![Three.js](https://img.shields.io/badge/Three.js-3D_Globe-000000?style=for-the-badge&logo=three.js&logoColor=white)](https://threejs.org)
[![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-3.0+-38BDF8?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com)
[![MITRE ATT&CK](https://img.shields.io/badge/MITRE-ATT%26CK_v14-RED?style=for-the-badge&logo=mitre&logoColor=white)](https://attack.mitre.org)
[![License](https://img.shields.io/badge/License-All_Rights_Reserved-red.svg?style=for-the-badge)](LICENSE)

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

### 📋 Prerequisites
- **Python**: `3.10` or higher
- **Node.js**: `18.0` or higher
- **npm**: `9.0` or higher

---

### 1️⃣ Clone the Repository
```bash
git clone https://github.com/pavankumar022/radar.git
cd radar
```

---

### 2️⃣ Backend Setup
```bash
# Navigate to radar directory
cd radar

# Create virtual environment
python -m venv .venv

# Activate virtual environment
# On Windows:
.venv\Scripts\activate
# On Linux/macOS:
source .venv/bin/activate

# Install dependencies
pip install -r backend/requirements.txt

# Start backend server
uvicorn backend.main:app --host 127.0.0.1 --port 8080
```
Backend API documentation will be available at: **`http://localhost:8080/api/docs`**

---

### 3️⃣ Frontend Setup
In a new terminal window:
```bash
# Navigate to frontend directory
cd radar/frontend

# Install node modules
npm install

# Start Vite dev server
npm run dev
```
Open your browser at: **`http://localhost:5173`**

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

## 🛡️ License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.
