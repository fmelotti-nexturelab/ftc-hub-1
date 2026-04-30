"""
bridge_sync.py — Avvia la sincronizzazione Bridge dal Task Scheduler.

Legge le credenziali da bridge_sync.cfg, effettua il login a FTC HUB,
poi chiama il NAV Agent locale (localhost:19999) che esegue il sync vero e proprio
(refresh Excel Power BI + lettura di tutti i fogli del file BRIDGE).

Uso:
    python bridge_sync.py              # refresh Excel + sync tutti i fogli
    python bridge_sync.py --no-excel   # sync senza refresh Power BI (file già aggiornato)

Configurazione in bridge_sync.cfg (stesso folder):
    [ftchub]
    url  = https://hub.tigeritalia.com
    user = fausto melotti
    pass = password

Task Scheduler: frequenza in base agli aggiornamenti Power BI (es. giornaliero).
Prerequisito: il NAV Agent (ftchub-nav-agent.exe) deve essere in esecuzione.
"""

import configparser
import sys
from datetime import datetime
from pathlib import Path

import requests

_SCRIPT_DIR = Path(__file__).parent
_CFG_PATH   = _SCRIPT_DIR / "bridge_sync.cfg"
_LOG_PATH   = _SCRIPT_DIR / "bridge_sync.log"
_AGENT_URL  = "http://localhost:19999"

_cfg = configparser.ConfigParser()
_cfg.read(_CFG_PATH, encoding="utf-8")

BACKEND_URL  = _cfg.get("ftchub", "url",  fallback="http://localhost:8000").rstrip("/")
BACKEND_USER = _cfg.get("ftchub", "user", fallback="")
BACKEND_PASS = _cfg.get("ftchub", "pass", fallback="")


def log(msg: str) -> None:
    line = f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] {msg}"
    print(line, flush=True)
    with open(_LOG_PATH, "a", encoding="utf-8") as f:
        f.write(line + "\n")


def main() -> None:
    no_excel = "--no-excel" in sys.argv
    log("=== bridge_sync start ===")

    if not BACKEND_USER or not BACKEND_PASS:
        log("ERRORE: credenziali mancanti in bridge_sync.cfg [ftchub] user/pass")
        sys.exit(1)

    log(f"Login backend ({BACKEND_USER})...")
    r = requests.post(
        f"{BACKEND_URL}/api/auth/login",
        json={"username": BACKEND_USER, "password": BACKEND_PASS},
        timeout=30,
        verify=False,
    )
    r.raise_for_status()
    token = r.json().get("access_token")
    if not token:
        log(f"ERRORE login: {r.text}")
        sys.exit(1)
    log("Login OK.")

    log(f"Chiamata agente bridge-sync (no_excel={no_excel})...")
    r = requests.post(
        f"{_AGENT_URL}/bridge-sync",
        json={"no_excel": no_excel, "backend_url": BACKEND_URL, "token": token},
        timeout=600,
    )
    r.raise_for_status()
    data = r.json()

    for key, count in (data.get("results") or {}).items():
        log(f"  {key}: {count:,} righe sincronizzate")
    for err in (data.get("errors") or []):
        log(f"  AVVISO: {err}")

    log("=== bridge_sync completato ===")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        import traceback
        log(f"ERRORE FATALE: {e}")
        log(traceback.format_exc())
        sys.exit(1)
