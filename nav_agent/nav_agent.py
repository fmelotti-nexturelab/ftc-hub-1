from http.server import HTTPServer, BaseHTTPRequestHandler
import json, subprocess, os, time

RDP_BASE = r"C:\Users\fmelo\OneDrive - Zebra A S\01 - NAVISION"
RDP_FILES = {
    "it01_classic": os.path.join(RDP_BASE, "NAV IT01.rdp"),
    "it02_classic": os.path.join(RDP_BASE, "NAV IT02.rdp"),
    "it02_new":     os.path.join(RDP_BASE, "NEW NAV IT02.rdp"),
    "it03_classic": os.path.join(RDP_BASE, "NAV IT03.rdp"),
    "it03_new":     os.path.join(RDP_BASE, "NEW NAV IT03.rdp"),
}

def count_mstsc():
    r = subprocess.run(["tasklist", "/FI", "IMAGENAME eq mstsc.exe", "/NH"], capture_output=True, text=True)
    return r.stdout.lower().count("mstsc.exe")

def open_rdp(key):
    path = RDP_FILES.get(key)
    if not path: return {"ok": False, "error": f"Chiave sconosciuta: {key}"}
    if not os.path.isfile(path): return {"ok": False, "error": f"File non trovato: {path}"}
    n = count_mstsc()
    subprocess.Popen(["mstsc", path])
    for _ in range(15):
        time.sleep(0.2)
        if count_mstsc() > n: break
    return {"ok": True, "sessions": count_mstsc()}

def kill_nav():
    killed = []
    for proc in ["mstsc.exe", "wksprt.exe"]:
        r = subprocess.run(["taskkill", "/F", "/IM", proc], capture_output=True, text=True)
        if r.returncode == 0: killed.append(proc)
    return {"ok": True, "killed": killed}

class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args): pass
    def _send(self, data, status=200):
        body = json.dumps(data).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "http://localhost:3000")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)
    def do_OPTIONS(self): self._send({})
    def do_GET(self):
        if self.path == "/ping": self._send({"ok": True, "agent": "nav_agent"})
        elif self.path == "/status": self._send({"ok": True, "sessions": count_mstsc()})
        else: self._send({"ok": False, "error": "Not found"}, 404)
    def do_POST(self):
        length = int(self.headers.get("Content-Length", 0))
        body = json.loads(self.rfile.read(length)) if length else {}
        if self.path == "/open-rdp": self._send(open_rdp(body.get("key", "")))
        elif self.path == "/kill-nav": self._send(kill_nav())
        else: self._send({"ok": False, "error": "Not found"}, 404)

if __name__ == "__main__":
    port = 9999
    print(f"[NAV Agent] in ascolto su http://localhost:{port}")
    for k, v in RDP_FILES.items():
        stato = "OK" if os.path.isfile(v) else "MANCANTE"
        print(f"  {k:15} [{stato}]")
    HTTPServer(("127.0.0.1", port), Handler).serve_forever()