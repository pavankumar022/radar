"""
RADAR — Live Network Packet Capture Engine (tcpdump / Raw Socket / Probe Listener)
Captures real network traffic on ports 22, 80, 443, 3389, 8080, 445, etc.
Parses packets, runs detection, and posts normalized live alerts to RADAR.
"""
import subprocess
import json
import re
import sys
import os
import signal
import socket
import time
import urllib.request
from datetime import datetime, timezone

KAFKA_BOOTSTRAP = os.getenv('KAFKA_BOOTSTRAP', 'localhost:9092')
RADAR_INGEST_URL = os.getenv('RADAR_INGEST_URL', 'http://127.0.0.1:8080/api/live/ingest')
PORTS_FILTER = 'port 22 or port 80 or port 443 or port 3389 or port 8080 or port 445'

running = True

def shutdown(signum, frame):
    global running
    running = False
    print("[LiveCapture] Shutting down capture engine...", flush=True)
    sys.exit(0)

signal.signal(signal.SIGTERM, shutdown)
signal.signal(signal.SIGINT, shutdown)

def send_alert_to_radar(event: dict):
    """POST captured network event directly to RADAR backend live ingestion."""
    try:
        data = json.dumps(event).encode('utf-8')
        req = urllib.request.Request(
            RADAR_INGEST_URL,
            data=data,
            headers={'Content-Type': 'application/json'}
        )
        with urllib.request.urlopen(req, timeout=2) as resp:
            pass
    except Exception as e:
        # Silently handle offline/busy backend
        pass

def parse_tcpdump_line(line: str) -> dict | None:
    """
    Parse tcpdump line format:
    14:22:01.123 IP 103.21.244.1.54321 > 192.168.1.5.22: tcp 0
    """
    pattern = re.compile(r'IP\s+(\d+\.\d+\.\d+\.\d+)\.(\d+)\s+>\s+(\d+\.\d+\.\d+\.\d+)\.(\d+)')
    match = pattern.search(line)
    if not match:
        return None

    src_ip = match.group(1)
    src_port = int(match.group(2))
    dst_ip = match.group(3)
    dst_port = int(match.group(4))

    # Skip loopback
    if src_ip.startswith('127.') or dst_ip.startswith('127.'):
        return None

    event = {
        'timestamp': datetime.now(timezone.utc).isoformat(),
        'src_ip': src_ip,
        'dst_ip': dst_ip,
        'src_port': src_port,
        'dst_port': dst_port,
        'layer': 'network',
        'protocol': 'TCP',
        'source': 'live_capture',
        'raw_line': line.strip()
    }

    if dst_port in (80, 443, 8080):
        event['event_type'] = 'HTTP_TRAFFIC'
        event['severity'] = 'warning'
        event['technique_id'] = 'T1190'
        event['description'] = f'Inbound Web Traffic Probe from {src_ip}:{src_port} to port {dst_port}'
    elif dst_port == 22:
        event['event_type'] = 'SSH_ATTEMPT'
        event['severity'] = 'critical'
        event['technique_id'] = 'T1110'
        event['description'] = f'SSH Authentication / Port probe from {src_ip}:{src_port}'
    elif dst_port == 3389:
        event['event_type'] = 'RDP_ATTEMPT'
        event['severity'] = 'critical'
        event['technique_id'] = 'T1021.001'
        event['description'] = f'RDP Remote Desktop connection attempt from {src_ip}:{src_port}'
    elif dst_port == 445:
        event['event_type'] = 'SMB_EXPLOIT_PROBE'
        event['severity'] = 'critical'
        event['technique_id'] = 'T1210'
        event['description'] = f'SMB Port 445 exploit scanning from {src_ip}:{src_port}'
    else:
        event['event_type'] = 'PORT_SCAN'
        event['severity'] = 'warning'
        event['technique_id'] = 'T1046'
        event['description'] = f'Network port scan probe from {src_ip}:{src_port} to port {dst_port}'

    return event

def run_tcpdump_capture():
    """Run tcpdump process if available on the system."""
    try:
        proc = subprocess.Popen(
            ['tcpdump', '-l', '-n', '-q', PORTS_FILTER],
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            text=True
        )
        print(f"[LiveCapture] tcpdump capture active on ports: {PORTS_FILTER}", flush=True)
        for line in proc.stdout:
            if not running:
                proc.terminate()
                break
            ev = parse_tcpdump_line(line)
            if ev:
                send_alert_to_radar(ev)
        return True
    except Exception as e:
        print(f"[LiveCapture] tcpdump failed: {e}", flush=True)
        return False

def run_socket_capture():
    """Fallback Python socket capture listener if tcpdump is not installed or on Windows."""
    print("[LiveCapture] Starting Python multi-port live socket listener...", flush=True)
    listen_ports = [22, 80, 443, 445, 3389, 8080]
    bound_sockets = []

    # Detect local target IP
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        local_ip = s.getsockname()[0]
        s.close()
    except Exception:
        local_ip = "0.0.0.0"

    for port in listen_ports:
        try:
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            sock.settimeout(0.2)
            sock.bind((local_ip, port))
            sock.listen(5)
            bound_sockets.append((sock, port))
        except Exception:
            pass

    print(f"[LiveCapture] Listening on IP {local_ip} across {len(bound_sockets)} security ports...", flush=True)
    scan_counts = {}

    while running:
        for sock, port in bound_sockets:
            try:
                conn, addr = sock.accept()
                src_ip = addr[0]
                src_port = addr[1]
                conn.close()

                if src_ip.startswith("127."):
                    continue

                now = time.time()
                scan_counts.setdefault(src_ip, []).append(now)
                scan_counts[src_ip] = [t for t in scan_counts[src_ip] if now - t <= 5.0]

                severity = "critical" if len(scan_counts[src_ip]) >= 3 or port in (22, 3389, 445) else "warning"
                event_type = "SSH_ATTEMPT" if port == 22 else ("RDP_ATTEMPT" if port == 3389 else "PORT_SCAN")
                technique = "T1110" if port == 22 else ("T1021.001" if port == 3389 else "T1046")

                event = {
                    'timestamp': datetime.now(timezone.utc).isoformat(),
                    'src_ip': src_ip,
                    'dst_ip': local_ip,
                    'src_port': src_port,
                    'dst_port': port,
                    'event_type': event_type,
                    'severity': severity,
                    'technique_id': technique,
                    'description': f'Live inbound network probe on port {port} from {src_ip}:{src_port}',
                    'source': 'live_capture',
                }
                send_alert_to_radar(event)
            except socket.timeout:
                pass
            except Exception:
                pass
        time.sleep(0.05)

if __name__ == '__main__':
    print("[LiveCapture] Initializing Live Network Capture Engine...", flush=True)
    if not run_tcpdump_capture():
        run_socket_capture()
