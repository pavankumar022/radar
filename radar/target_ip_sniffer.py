"""
RADAR — Live Real-time Target IP Nmap & Port Scan Sniffer
Runs on the MACHINE being scanned (Windows/Linux). Captures live incoming
Nmap / SYN / brute-force scans and posts real-time alerts to the RADAR
backend (cloud on Render or local).

Usage:
  python target_ip_sniffer.py [--radar-url https://radar-backend-lmzh.onrender.com] [--ip 192.168.1.5]

Run as ADMINISTRATOR on Windows so raw socket mode works correctly.
"""
import socket
import sys
import time
import json
import struct
import urllib.request
import argparse
from datetime import datetime, timezone

def get_local_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"


RENDER_URL = "https://radar-backend-lmzh.onrender.com"
LOCAL_URL  = "http://localhost:8080"


def detect_radar_url():
    """Auto-detect: use local backend if it responds, else use Render."""
    try:
        req = urllib.request.Request(LOCAL_URL + "/health", method="GET")
        with urllib.request.urlopen(req, timeout=2) as resp:
            if resp.status == 200:
                return LOCAL_URL
    except Exception:
        pass
    return RENDER_URL


def main():
    parser = argparse.ArgumentParser(description="RADAR Real-time Port Scan & Nmap Sniffer")
    parser.add_argument(
        "--radar-url", default="",
        help="RADAR backend URL. Leave empty to auto-detect (local → Render)."
    )
    parser.add_argument(
        "--both", action="store_true",
        help="Send alerts to BOTH local and Render backends simultaneously."
    )
    parser.add_argument("--ip", default="", help="Target IP to monitor (default: auto-detect local IP)")
    args = parser.parse_args()

    if args.both:
        ingest_urls = [LOCAL_URL + "/api/live/ingest", RENDER_URL + "/api/live/ingest"]
        print(" ⚡ Sending to BOTH local and Render backends")
    elif args.radar_url:
        ingest_urls = [args.radar_url.rstrip("/") + "/api/live/ingest"]
    else:
        detected = detect_radar_url()
        ingest_urls = [detected + "/api/live/ingest"]
        label = "local backend" if "localhost" in detected else "Render (cloud — Vercel will see alerts)"
        print(f" 🔍 Auto-detected backend: {label}")

    target_ip = args.ip or get_local_ip()

    print("==========================================================")
    print(" RADAR Live Target IP Sniffer")
    print(f" Monitoring IP   : {target_ip}")
    for u in ingest_urls:
        print(f" Sending to      : {u}")
    print(" Capturing Nmap, SYN scans, brute-force probes...")
    print("==========================================================\n")

    # Rate limiting: avoid flooding the backend
    scan_history = {}      # src_ip -> list of probe timestamps
    last_alert_time = {}   # (src_ip, event_type) -> timestamp

    import queue
    import threading

    alert_queue = queue.Queue()

    def alert_sender_worker():
        while True:
            try:
                url, payload = alert_queue.get()
                req = urllib.request.Request(
                    url,
                    data=json.dumps(payload).encode("utf-8"),
                    headers={"Content-Type": "application/json"},
                    method="POST",
                )
                with urllib.request.urlopen(req, timeout=4) as resp:
                    print(f"  ✓ ALERT → [{payload['event_type']}] {payload['src_ip']}→{payload['dst_ip']}:{payload['dst_port']} ({url.split('/')[2]})")
            except Exception as e:
                try:
                    host = url.split('/')[2]
                except Exception:
                    host = "unknown"
                print(f"  ✗ FAIL  → {payload['event_type']} @ {host} ({e})")
            finally:
                alert_queue.task_done()

    # Start the asynchronous HTTP poster thread
    threading.Thread(target=alert_sender_worker, daemon=True).start()

    def send_alert(src_ip, dst_port, event_type, technique, description, severity="critical"):
        """Queue a normalized alert for posting asynchronously to all backends."""
        key = (src_ip, event_type)
        now = time.time()
        # Rate limit: max 1 alert per src+event_type per 0.5 seconds for fast live updates
        if now - last_alert_time.get(key, 0) < 0.5:
            return
        last_alert_time[key] = now

        payload = {
            "src_ip": src_ip,
            "dst_ip": target_ip,
            "dst_port": dst_port,
            "event_type": event_type,
            "severity": severity,
            "technique_id": technique,
            "tactic": "Reconnaissance" if technique == "T1046" else "Credential Access",
            "description": description,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "source": "live_capture",
        }
        for url in ingest_urls:
            alert_queue.put((url, payload))

    def classify_port(port):
        """Return (event_type, technique_id, severity) based on destination port."""
        if port == 22:
            return "SSH_BRUTE_FORCE", "T1110", "critical"
        if port == 3389:
            return "RDP_ATTEMPT", "T1021.001", "critical"
        if port == 445:
            return "SMB_EXPLOIT_PROBE", "T1210", "critical"
        if port in (80, 443, 8080, 8443):
            return "HTTP_TRAFFIC", "T1190", "warning"
        if port in (21, 23, 25, 110, 143, 1433, 3306, 5432):
            return "SERVICE_PROBE", "T1046", "warning"
        return "NMAP_PORT_SCAN", "T1046", "critical"

    # ─── Raw Socket Mode (Admin required on Windows) ────────────────────────────
    try:
        if sys.platform == "win32":
            sniffer = socket.socket(socket.AF_INET, socket.SOCK_RAW, socket.IPPROTO_IP)
            sniffer.bind((target_ip, 0))
            sniffer.setsockopt(socket.IPPROTO_IP, socket.IP_HDRINCL, 1)
            sniffer.ioctl(socket.SIO_RCVALL, socket.RCVALL_ON)
        else:
            sniffer = socket.socket(socket.AF_PACKET, socket.SOCK_RAW, socket.ntohs(0x0800))

        print("[+] Raw socket mode active — capturing all inbound IP packets in real-time.\n")

        while True:
            raw_data, _ = sniffer.recvfrom(65535)

            # On Windows, raw IP header starts at byte 0.
            # Parse IP header (first 20 bytes minimum)
            if len(raw_data) < 20:
                continue

            ip_hdr = raw_data[:20]
            version_ihl = ip_hdr[0]
            ihl = (version_ihl & 0x0F) * 4  # IP header length in bytes
            protocol = ip_hdr[9]

            src_bytes = ip_hdr[12:16]
            dst_bytes = ip_hdr[16:20]
            src_ip = socket.inet_ntoa(src_bytes)
            dst_ip = socket.inet_ntoa(dst_bytes)

            # Only care about traffic targeting our monitored IP
            if dst_ip != target_ip:
                continue

            # Skip self and loopback
            if src_ip == target_ip or src_ip.startswith("127."):
                continue

            dst_port = 0

            # TCP (protocol 6) — extract destination port
            if protocol == 6 and len(raw_data) >= ihl + 4:
                tcp_hdr = raw_data[ihl:ihl + 4]
                dst_port = struct.unpack("!HH", tcp_hdr)[1]

            # UDP (protocol 17)
            elif protocol == 17 and len(raw_data) >= ihl + 4:
                udp_hdr = raw_data[ihl:ihl + 4]
                dst_port = struct.unpack("!HH", udp_hdr)[1]

            # Track probes per attacker
            now = time.time()
            scan_history.setdefault(src_ip, []).append((now, dst_port))
            scan_history[src_ip] = [(t, p) for t, p in scan_history[src_ip] if now - t <= 5.0]
            probe_count = len(scan_history[src_ip])

            event_type, technique, severity = classify_port(dst_port)

            # Emit alert if probe burst detected (>= 3 probes in 5s) or on critical port
            if probe_count >= 3 or protocol == 6 and dst_port in (22, 3389, 445, 1433, 3306):
                desc = (
                    f"Real-time {event_type} detected: {probe_count} probe(s) from {src_ip} "
                    f"targeting {target_ip}:{dst_port} (MITRE {technique})"
                )
                send_alert(src_ip, dst_port, event_type, technique, desc, severity)

    except PermissionError:
        print("[!] Raw socket requires Administrator privileges.")
        print("[*] Falling back to TCP port listener mode (limited detection)...\n")
        _run_port_listener(target_ip, ingest_url, send_alert, classify_port)
    except Exception as raw_err:
        print(f"[*] Raw socket unavailable ({raw_err}). Falling back to port listener mode...\n")
        _run_port_listener(target_ip, ingest_url, send_alert, classify_port)


def _run_port_listener(target_ip, ingest_url, send_alert, classify_port):
    """Fallback: bind to common ports and accept TCP connections to detect scans."""
    listen_ports = [21, 22, 80, 135, 139, 443, 445, 1433, 3306, 3389, 5432, 8080, 8443]
    sockets = []
    for port in listen_ports:
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            s.settimeout(0.08)
            s.bind((target_ip, port))
            s.listen(10)
            sockets.append((s, port))
        except Exception:
            pass

    if not sockets:
        print(f"[!] Could not bind to any port on {target_ip}. Run as Administrator.")
        return

    print(f"[+] Listening on {len(sockets)} ports for incoming scan connections: "
          f"{[p for _, p in sockets]}")

    while True:
        for sock, port in sockets:
            try:
                conn, addr = sock.accept()
                src_ip = addr[0]
                conn.close()
                if src_ip.startswith("127."):
                    continue
                event_type, technique, severity = classify_port(port)
                desc = f"Inbound TCP probe on port {port} from {src_ip} → {target_ip}"
                send_alert(src_ip, port, event_type, technique, desc, severity)
            except socket.timeout:
                pass
            except Exception:
                pass
        time.sleep(0.02)


if __name__ == "__main__":
    main()
