"""
FTC HUB — NAV Agent
Piccolo server HTTP locale (localhost:9999) che lancia sessioni RDP
verso Navision ricevendo le credenziali dal frontend di FTC HUB.

Flusso per ogni sessione:
  1. cmdkey /add:SERVER /user:USERNAME /pass:PASSWORD  → salva nel Credential Manager
  2. mstsc.exe /v:SERVER                               → apre RDP senza prompt
  3. cmdkey /delete:SERVER                             → pulisce subito

Compatibile con Windows 10/11. Richiede mstsc.exe nel PATH (sempre presente).
All'avvio si registra automaticamente nella chiave di avvio di Windows
(HKCU\Software\Microsoft\Windows\CurrentVersion\Run) — nessun privilegio
di amministratore richiesto.
"""
from http.server import HTTPServer, BaseHTTPRequestHandler
import json
import os
import subprocess
import sys
import tempfile
import time
import winreg

REG_KEY   = r"Software\Microsoft\Windows\CurrentVersion\Run"
REG_NAME  = "FTCHubNavAgent"


def register_autostart() -> None:
    """Aggiunge l'exe alla chiave di avvio automatico di Windows (HKCU).
    Non richiede privilegi di amministratore. Operazione silenziosa."""
    exe_path = sys.executable
    try:
        with winreg.OpenKey(winreg.HKEY_CURRENT_USER, REG_KEY, 0, winreg.KEY_READ) as key:
            current, _ = winreg.QueryValueEx(key, REG_NAME)
            if current == exe_path:
                return  # già registrato con il percorso corretto
    except FileNotFoundError:
        pass  # chiave non esiste ancora → la creiamo sotto

    try:
        with winreg.OpenKey(winreg.HKEY_CURRENT_USER, REG_KEY, 0, winreg.KEY_SET_VALUE) as key:
            winreg.SetValueEx(key, REG_NAME, 0, winreg.REG_SZ, exe_path)
    except OSError:
        pass  # fallisce silenziosamente — non blocca l'avvio


ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://localhost",
    "https://hub.nexturelab.com",
    "https://HO-SERVICES",
    "https://10.74.0.110",
]


def count_mstsc() -> int:
    r = subprocess.run(
        ["tasklist", "/FI", "IMAGENAME eq mstsc.exe", "/NH"],
        capture_output=True, text=True,
    )
    return r.stdout.lower().count("mstsc.exe")


def _build_rdp(server: str, username: str, gateway: str,
               app_name: str, app_cmdline: str, label: str) -> str:
    """Genera il contenuto di un file .rdp per RemoteApp con gateway."""
    is_remoteapp = bool(app_name)
    lines = [
        "redirectclipboard:i:1",
        "redirectprinters:i:1",
        "redirectcomports:i:0",
        "redirectsmartcards:i:1",
        "devicestoredirect:s:*",
        "drivestoredirect:s:*",
        "redirectdrives:i:1",
        "session bpp:i:32",
        "prompt for credentials on client:i:0",
        "span monitors:i:1",
        "use multimon:i:1",
        f"remoteapplicationmode:i:{1 if is_remoteapp else 0}",
        "server port:i:3389",
        "allow font smoothing:i:1",
        "promptcredentialonce:i:1",
        "videoplaybackmode:i:1",
        "audiocapturemode:i:1",
        f"full address:s:{server}",
        f"alternate full address:s:{server}",
        f"username:s:{username}",
    ]
    if gateway:
        lines += [
            "gatewayusagemethod:i:2",
            "gatewayprofileusagemethod:i:1",
            "gatewaycredentialssource:i:0",
            f"gatewayhostname:s:{gateway}",
            "use redirection server name:i:1",
            "loadbalanceinfo:s:tsv://MS Terminal Services Plugin.1.Remote_Apps_125",
        ]
    if is_remoteapp:
        lines += [
            f"alternate shell:s:||{app_name}",
            f"remoteapplicationprogram:s:||{app_name}",
            f"remoteapplicationname:s:{label or app_name}",
            f"remoteapplicationcmdline:s:{app_cmdline or ''}",
            f"workspace id:s:{server}",
        ]
    return "\r\n".join(lines) + "\r\n"


def open_rdp(server: str, username: str, password: str,
             gateway: str = "", app_name: str = "",
             app_cmdline: str = "", label: str = "") -> dict:
    if not server or not username or not password:
        return {"ok": False, "error": "Parametri mancanti (server, username, password)"}

    cred_target = f"TERMSRV/{gateway or server}"

    # 1. Salva credenziali per gateway (o server diretto)
    try:
        subprocess.run(
            ["cmdkey", f"/add:{cred_target}", f"/user:{username}", f"/pass:{password}"],
            capture_output=True, check=True,
        )
    except subprocess.CalledProcessError as e:
        return {"ok": False, "error": f"cmdkey /add fallito: {e}"}

    tmp_path = None
    try:
        # 2. Scrivi file .rdp temporaneo
        rdp_content = _build_rdp(server, username, gateway, app_name, app_cmdline, label)
        fd, tmp_path = tempfile.mkstemp(suffix=".rdp", prefix="ftchub_nav_")
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            f.write(rdp_content)

        # 3. Lancia mstsc con il file temporaneo
        n_before = count_mstsc()
        subprocess.Popen(["mstsc", tmp_path])

        for _ in range(15):
            time.sleep(0.2)
            if count_mstsc() > n_before:
                break

    except FileNotFoundError:
        return {"ok": False, "error": "mstsc.exe non trovato"}
    finally:
        subprocess.run(["cmdkey", f"/delete:{cred_target}"], capture_output=True)
        if tmp_path and os.path.exists(tmp_path):
            try:
                os.remove(tmp_path)
            except OSError:
                pass

    return {"ok": True, "sessions": count_mstsc()}


def kill_nav() -> dict:
    killed = []
    for proc in ["mstsc.exe", "wksprt.exe"]:
        r = subprocess.run(["taskkill", "/F", "/IM", proc], capture_output=True, text=True)
        if r.returncode == 0:
            killed.append(proc)
    return {"ok": True, "killed": killed}


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        pass  # silenzia i log HTTP

    def _origin(self):
        return self.headers.get("Origin", "")

    def _send(self, data, status=200):
        body = json.dumps(data).encode()
        origin = self._origin()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        if origin in ALLOWED_ORIGINS:
            self.send_header("Access-Control-Allow-Origin", origin)
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self._send({})

    def do_GET(self):
        if self.path == "/ping":
            self._send({"ok": True, "agent": "ftchub-nav-agent", "version": "2.0"})
        elif self.path == "/status":
            self._send({"ok": True, "sessions": count_mstsc()})
        else:
            self._send({"ok": False, "error": "Not found"}, 404)

    def do_POST(self):
        length = int(self.headers.get("Content-Length", 0))
        body = json.loads(self.rfile.read(length)) if length else {}

        if self.path == "/open-rdp":
            result = open_rdp(
                server=body.get("server", ""),
                username=body.get("username", ""),
                password=body.get("password", ""),
                gateway=body.get("gateway", ""),
                app_name=body.get("app_name", ""),
                app_cmdline=body.get("app_cmdline", ""),
                label=body.get("label", ""),
            )
            self._send(result)
        elif self.path == "/kill-nav":
            self._send(kill_nav())
        else:
            self._send({"ok": False, "error": "Not found"}, 404)


if __name__ == "__main__":
    register_autostart()
    port = 9999
    print(f"[FTC HUB - NAV Agent v2.0] in ascolto su http://localhost:{port}")
    print("Premi Ctrl+C per fermare.\n")
    try:
        HTTPServer(("127.0.0.1", port), Handler).serve_forever()
    except KeyboardInterrupt:
        print("\n[NAV Agent] Fermato.")
