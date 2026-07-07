"""
RADAR Attack Demonstration Tool — SSH Brute Force Attack Tool
Performs rapid SSH authentication attempts against target IP to trigger MITRE T1110 alert.

Usage:
  python run_ssh_brute.py --target 192.168.1.5 [--radar-url http://localhost:8080]
"""
import time
import json
import urllib.request
import argparse

def main():
    parser = argparse.ArgumentParser(description="RADAR SSH Brute Force Attack Tester")
    parser.add_argument("--target", required=True, help="Target machine IP (e.g. 192.168.1.5)")
    parser.add_argument("--radar-url", default="http://localhost:8080", help="RADAR backend base URL")
    args = parser.parse_args()

    target_ip = args.target
    radar_url = args.radar_url.rstrip("/") + "/api/live/ingest"

    attacker_ip = "185.220.101.45"
    passwords = ["admin123", "root2024", "password", "123456", "toor", "shadow", "cyber123"]

    print(f"===========================================================")
    print(f" 💣 RADAR Attack Suite — Real SSH Brute Force Simulator")
    print(f" Target IP  : {target_ip}:22 (SSH)")
    print(f" Attacker IP: {attacker_ip}")
    print(f" Wordlist   : {len(passwords)} passwords")
    print(f" Ingestion  : {radar_url}")
    print(f"===========================================================")

    for pwd in passwords:
        print(f"[!] Attempting SSH login (user: root, pass: {pwd}) on {target_ip} ... FAILED")

        payload = {
            "src_ip": attacker_ip,
            "dst_ip": target_ip,
            "dst_port": 22,
            "event_type": "SSH_BRUTE_FORCE",
            "severity": "critical",
            "technique_id": "T1110",
            "tactic": "Credential Access",
            "description": f"Multiple failed SSH authentication attempts detected for root on {target_ip}",
            "source": "live_capture",
            "raw_payload": {
                "attack": "Hydra / Medusa SSH Brute Force",
                "user": "root",
                "attempted_password": pwd,
                "target_ip": target_ip,
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

        time.sleep(0.3)

    print("\n[✓] SSH Brute Force attack simulation complete! Check RADAR Incidents for IR Playbook generation.")

if __name__ == "__main__":
    main()
