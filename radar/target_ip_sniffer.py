"""
RADAR — Live Real-time Target IP Nmap & Port Scan Sniffer
Captures live incoming network scans (Nmap, SYN scans, service probes)
targeting local machine IP and posts real-time security alerts to RADAR.

Usage:
  python target_ip_sniffer.py [--radar-url http://localhost:8080] [--ip 192.168.1.5]
"""
import socket
import sys
import time
import json
import urllib.request
import argparse
from datetime import datetime, timezone

def main():
    parser = argparse.ArgumentParser(description="RADAR Real-time Port Scan & Nmap Sniffer")
    parser.add_argument("--radar-url", default="http://localhost:8080", help="RADAR backend base URL")
    parser.add_argument("--ip", default="", help="Target IP to monitor (default: auto-detect)")
    args = parser.parse_args()

    radar_url = args.radar_url.rstrip("/") + "/api/logs/target-ip"

    target_ip = args.ip
    if not target_ip:
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.connect(("8.8.8.8", 80))
            target_ip = s.getsockname()[0]
            s.close()
        except Exception:
            target_ip = "127.0.0.1"

    print(f"==========================================================")
    print(f" RADAR Live Target IP Sniffer Active")
    print(f" Target IP Monitored : {target_ip}")
    print(f" Ingestion Endpoint  : {radar_url}")
    print(f" Listening for live Nmap scans & probes...")
    print(f"==========================================================")

    # Track incoming probes per source IP: src_ip -> list of (timestamp, port)
    scan_history = {}
    last_alert_time = {}

    def report_scan(src_ip, port_count, description, technique="T1046", event_type="NMAP_PORT_SCAN", severity="critical"):
        now_ts = time.time()
        # Rate limit identical alert type per src_ip to once every 2 seconds
        if now_ts - last_alert_time.get((src_ip, event_type), 0) < 2.0:
            return
        last_alert_time[(src_ip, event_type)] = now_ts

        payload = {
            "source_ip": src_ip,
            "destination_ip": target_ip,
            "event_type": event_type,
            "severity": severity,
            "technique_id": technique,
            "tactic": "Reconnaissance",
            "description": f"{description} targeting {target_ip}",
            "raw_payload": {
                "sniffer": "RADAR_LIVE_SNIFFER",
                "probes_detected": port_count,
                "target_ip": target_ip,
                "scanner_ip": src_ip,
            }
        }
        try:
            req = urllib.request.Request(
                radar_url,
                data=json.dumps(payload).encode("utf-8"),
                headers={"Content-Type": "application/json"}
            )
            with urllib.request.urlopen(req, timeout=3) as resp:
                print(f" [ALERT SENT] {event_type} from {src_ip} -> {target_ip} ({port_count} ports probed)")
        except Exception as e:
            print(f" [ALERT QUEUED] {event_type} from {src_ip} -> {target_ip} (POST failed: {e})")

    # Try raw socket first (requires Admin/root on Linux/Windows)
    try:
        if sys.platform == "win32":
            sniffer = socket.socket(socket.AF_INET, socket.SOCK_RAW, socket.IPPROTO_IP)
            sniffer.bind((target_ip, 0))
            sniffer.setsockopt(socket.IPPROTO_IP, socket.IP_HDRINCL, 1)
            sniffer.ioctl(socket.SIO_RCVALL, socket.RCVALL_ON)
        else:
            sniffer = socket.socket(socket.AF_PACKET, socket.SOCK_RAW, socket.ntohs(0x0003))

        print("[+] Raw socket mode enabled — capturing IP header probes in real-time.")
        while True:
            raw_data, _ = sniffer.recvfrom(65535)
            if len(raw_data) >= 20:
                ip_hdr = raw_data[:20]
                src_bytes = ip_hdr[12:16]
                dst_bytes = ip_hdr[16:20]
                src_ip = socket.inet_ntoa(src_bytes)
                dst_ip = socket.inet_ntoa(dst_bytes)

                if src_ip != target_ip and src_ip != "127.0.0.1":
                    now = time.time()
                    scan_history.setdefault(src_ip, []).append(now)
                    # Clean probes older than 5 seconds
                    scan_history[src_ip] = [t for t in scan_history[src_ip] if now - t <= 5.0]

                    if len(scan_history[src_ip]) >= 5:
                        report_scan(
                            src_ip=src_ip,
                            port_count=len(scan_history[src_ip]),
                            description=f"Active Nmap/Port scan probe sequence ({len(scan_history[src_ip])} packets/5s)",
                            technique="T1046",
                            event_type="NMAP_PORT_SCAN",
                            severity="critical"
                        )

    except Exception as raw_err:
        print(f"[*] Raw socket capture unavailable ({raw_err}). Falling back to multi-port listener mode...")
        # Fallback multi-port socket listener for non-admin mode
        listen_ports = [21, 22, 80, 135, 139, 445, 1433, 3306, 3389, 5432, 8080, 8443]
        sockets = []
        for port in listen_ports:
            try:
                s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
                s.settimeout(0.1)
                s.bind((target_ip, port))
                s.listen(5)
                sockets.append((s, port))
            except Exception:
                pass

        print(f"[+] Listening on {len(sockets)} common ports for incoming scan connections...")
        while True:
            for s, port in sockets:
                try:
                    conn, addr = s.accept()
                    src_ip = addr[0]
                    conn.close()
                    report_scan(
                        src_ip=src_ip,
                        port_count=1,
                        description=f"Inbound TCP connection probe on port {port}",
                        technique="T1046",
                        event_type="PORT_SCAN",
                        severity="warning"
                    )
                except socket.timeout:
                    pass
                except Exception:
                    pass
            time.sleep(0.05)

if __name__ == "__main__":
    main()
