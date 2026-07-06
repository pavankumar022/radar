"""
RADAR Attack Demonstration Tool — Nmap Multi-Port Scanner
Performs real TCP port scan probes against the target IP and sends alerts to RADAR.

Usage:
  # Send to local backend (when running project locally):
  python run_nmap_scan.py --target 192.168.1.5 --radar-url http://localhost:8080

  # Send to deployed Render backend (to see on Vercel dashboard):
  python run_nmap_scan.py --target 192.168.1.5 --radar-url https://radar-backend-lmzh.onrender.com

  # Auto mode (detects local vs. deployed):
  python run_nmap_scan.py --target 192.168.1.5
"""
import socket
import time
import json
import urllib.request
import urllib.error
import argparse

RENDER_URL = "https://radar-backend-lmzh.onrender.com"
LOCAL_URL  = "http://localhost:8080"


def detect_radar_url():
    """Auto-detect: use local backend if it responds, else use Render."""
    try:
        req = urllib.request.Request(
            LOCAL_URL + "/health",
            method="GET",
        )
        with urllib.request.urlopen(req, timeout=2) as resp:
            if resp.status == 200:
                return LOCAL_URL
    except Exception:
        pass
    return RENDER_URL


def main():
    parser = argparse.ArgumentParser(description="RADAR Nmap Port Scan Attack Tester")
    parser.add_argument("--target", required=True, help="Target machine IP (e.g. 192.168.1.5)")
    parser.add_argument(
        "--radar-url",
        default="",
        help="RADAR backend URL. Leave empty to auto-detect (local → Render)."
    )
    parser.add_argument(
        "--both",
        action="store_true",
        help="Send alerts to BOTH local and Render backends simultaneously."
    )
    args = parser.parse_args()

    target_ip = args.target

    if args.both:
        radar_urls = [LOCAL_URL, RENDER_URL]
        print(" ⚡ Sending to BOTH local and Render backends")
    elif args.radar_url:
        radar_urls = [args.radar_url.rstrip("/")]
    else:
        detected = detect_radar_url()
        radar_urls = [detected]
        label = "local backend" if "localhost" in detected else "Render (cloud)"
        print(f" 🔍 Auto-detected backend: {label} ({detected})")

    ingest_urls = [u + "/api/live/ingest" for u in radar_urls]

    target_ports = [21, 22, 80, 135, 139, 443, 445, 1433, 3306, 3389, 5432, 8080, 8443]

    print(f"===================================================================")
    print(f" 🎯 RADAR Attack Suite — Real Nmap Scan Simulator")
    print(f" Target IP    : {target_ip}")
    print(f" Ports Scanned: {target_ports}")
    for u in ingest_urls:
        print(f" Sending to   : {u}")
    print(f"===================================================================\n")

    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        attacker_ip = s.getsockname()[0]
        s.close()
    except Exception:
        attacker_ip = "185.220.101.5"

    print(f" Attacker IP  : {attacker_ip}\n")

    for port in target_ports:
        print(f"[+] Probing {target_ip}:{port} ...", end="", flush=True)
        try:
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(0.4)
            res = sock.connect_ex((target_ip, port))
            sock.close()
            status = "OPEN" if res == 0 else "CLOSED/FILTERED"
            print(f" {status}")
        except Exception as e:
            print(f" PROBE_SENT ({e})")

        payload = {
            "src_ip": attacker_ip,
            "dst_ip": target_ip,
            "dst_port": port,
            "event_type": "NMAP_PORT_SCAN",
            "severity": "critical",
            "technique_id": "T1046",
            "tactic": "Reconnaissance",
            "description": f"Real-time Nmap Port Scan Probe on port {port} targeting {target_ip} from {attacker_ip}",
            "source": "nmap_scanner",
        }

        import threading

        def post_alert(url, data):
            try:
                req = urllib.request.Request(
                    url,
                    data=json.dumps(data).encode("utf-8"),
                    headers={"Content-Type": "application/json"},
                )
                with urllib.request.urlopen(req, timeout=5) as resp:
                    pass
            except Exception:
                pass

        for ingest_url in ingest_urls:
            threading.Thread(target=post_alert, args=(ingest_url, payload), daemon=True).start()

        time.sleep(0.01)

    print(f"\n[✓] Nmap scan complete!")
    print(f"[✓] Check your RADAR dashboard for live alerts and 3D Globe arcs:")
    if any("localhost" in u for u in ingest_urls):
        print(f"    → Local:   http://localhost:5173/dashboard")
    if any("render" in u for u in ingest_urls):
        print(f"    → Vercel:  https://radar-real-time-autonomous-defense.vercel.app/dashboard")


if __name__ == "__main__":
    main()
