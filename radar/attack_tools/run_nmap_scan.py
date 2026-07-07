"""
RADAR Attack Demonstration Tool — Nmap Multi-Port Scanner
Performs real TCP port scan probes against the target IP and sends alerts to RADAR.

Usage:
  python run_nmap_scan.py --target 192.168.1.5 [--radar-url http://localhost:8080]
"""
import socket
import time
import json
import urllib.request
import argparse

def main():
    parser = argparse.ArgumentParser(description="RADAR Nmap Port Scan Attack Tester")
    parser.add_argument("--target", required=True, help="Target machine IP (e.g. 192.168.1.5)")
    parser.add_argument("--radar-url", default="http://localhost:8080", help="RADAR backend base URL")
    args = parser.parse_args()

    target_ip = args.target
    radar_url = args.radar_url.rstrip("/") + "/api/live/ingest"

    target_ports = [21, 22, 80, 135, 139, 445, 1433, 3306, 3389, 5432, 8080, 8443]

    print(f"===========================================================")
    print(f" 🎯 RADAR Attack Suite — Real Nmap Scan Simulator")
    print(f" Target IP    : {target_ip}")
    print(f" Ports Scanned: {target_ports}")
    print(f" Ingestion    : {radar_url}")
    print(f"===========================================================")

    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        attacker_ip = s.getsockname()[0]
        s.close()
    except Exception:
        attacker_ip = "185.220.101.5"

    for port in target_ports:
        print(f"[+] Probing {target_ip}:{port} ...", end="", flush=True)
        try:
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(0.5)
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
            "description": f"Real-time Nmap Port Scan Probe on port {port} targeting {target_ip}",
            "source": "live_capture",
            "raw_payload": {
                "scan_type": "-A / -sS TCP SYN Scan",
                "target": target_ip,
                "port": port,
                "attacker": attacker_ip
            }
        }

        try:
            req = urllib.request.Request(
                radar_url,
                data=json.dumps(payload).encode("utf-8"),
                headers={"Content-Type": "application/json"}
            )
            with urllib.request.urlopen(req, timeout=3) as resp:
                pass
        except Exception:
            pass

        time.sleep(0.1)

    print("\n[✓] Nmap scan complete! Check the RADAR dashboard for live alerts and 3D Globe arcs.")

if __name__ == "__main__":
    main()
