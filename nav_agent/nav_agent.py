"""ftchub-nav-agent — agent locale per operazioni desktop (Excel COM, RDP, ExpoList)
Porta: 9999
"""

import json
import os
import subprocess
import time
from datetime import datetime
from pathlib import Path

import openpyxl
import uvicorn
import win32com.client
import win32con
import win32gui
import win32process
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# ── Percorso ExpoList ────────────────────────────────────────────────────────
# La directory base può essere sovrascritta tramite variabile d'ambiente
# EXPO_LIST_BASE_DIR (utile se il percorso utente cambia tra installazioni).
_EXPO_BASE = Path(
    os.environ.get(
        "EXPO_LIST_BASE_DIR",
        r"C:\Users\fmelo\Zebra A S\One Italy Stores - Files",
    )
)
EXPO_LIST_PATH = _EXPO_BASE / r"00 - Estrazioni\97 - Service\01 - Tables\tbl_ExpoList.xlsm"
ECO_LIST_PATH       = _EXPO_BASE / r"00 - Estrazioni\97 - Service\01 - Tables\tbl_ECO.xlsx"
ECCEZIONI_LIST_PATH = _EXPO_BASE / r"00 - Estrazioni\97 - Service\01 - Tables\tbl_Eccezioni.xlsm"
KGL_LIST_PATH       = _EXPO_BASE / r"00 - Estrazioni\97 - Service\01 - Tables\tbl_KGL.xlsm"


# ── Modelli request ──────────────────────────────────────────────────────────

class OpenRequest(BaseModel):
    path: str

class OpenConverterRequest(BaseModel):
    url: str
    filenameMatch: str

class PasteRequest(BaseModel):
    filenameMatch: str
    sheetName: str
    rows: list[list]


# ── Helper: trova workbook Excel aperto per nome ─────────────────────────────

def _find_workbook(xl, filename_match: str):
    for wb in xl.Workbooks:
        if filename_match.lower() in wb.Name.lower():
            return wb
    return None


# ── Endpoint esistenti ───────────────────────────────────────────────────────

@app.get("/ping")
def ping():
    return {"status": "ok"}


@app.post("/open")
def open_rdp(req: OpenRequest):
    try:
        subprocess.Popen(["mstsc.exe", req.path])
        return {"ok": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/focus")
def focus_rdp():
    def _enum(hwnd, _):
        if win32gui.IsWindowVisible(hwnd):
            _, pid = win32process.GetWindowThreadProcessId(hwnd)
            try:
                import psutil
                proc = psutil.Process(pid)
                if "mstsc" in proc.name().lower():
                    win32gui.SetForegroundWindow(hwnd)
            except Exception:
                pass
    win32gui.EnumWindows(_enum, None)
    return {"ok": True}


@app.post("/kill")
def kill_sessions():
    killed = 0
    def _enum(hwnd, _):
        nonlocal killed
        if win32gui.IsWindowVisible(hwnd):
            _, pid = win32process.GetWindowThreadProcessId(hwnd)
            try:
                import psutil
                proc = psutil.Process(pid)
                if "mstsc" in proc.name().lower():
                    proc.kill()
                    killed += 1
            except Exception:
                pass
    win32gui.EnumWindows(_enum, None)
    return {"killed": killed}


@app.post("/open-converter")
def open_converter(req: OpenConverterRequest):
    """Apre il file Convertitore in Excel desktop via protocollo ms-excel.
    Se già aperto, porta la finestra in primo piano.
    Fa polling finché Excel non ha il file attivo (timeout 60s).
    """
    try:
        xl = win32com.client.GetActiveObject("Excel.Application")
    except Exception:
        xl = win32com.client.Dispatch("Excel.Application")
    xl.Visible = True

    wb = _find_workbook(xl, req.filenameMatch)
    if not wb:
        os.startfile(f"ms-excel:ofe|u|{req.url}")
        deadline = time.time() + 60
        while time.time() < deadline:
            time.sleep(1)
            wb = _find_workbook(xl, req.filenameMatch)
            if wb:
                break
        if not wb:
            raise HTTPException(status_code=504, detail="Timeout: Excel non ha aperto il file entro 60s")

    # Porta in primo piano
    try:
        hwnd = xl.Hwnd
        win32gui.ShowWindow(hwnd, win32con.SW_RESTORE)
        win32gui.SetForegroundWindow(hwnd)
    except Exception:
        pass

    return {"ok": True, "workbook": wb.Name}


@app.post("/paste-to-converter")
def paste_to_converter(req: PasteRequest):
    """Scrive rows nel foglio sheetName del workbook che contiene filenameMatch."""
    try:
        xl = win32com.client.GetActiveObject("Excel.Application")
    except Exception:
        raise HTTPException(status_code=404, detail="Excel non è aperto")

    wb = _find_workbook(xl, req.filenameMatch)
    if not wb:
        raise HTTPException(status_code=404, detail=f'Workbook "{req.filenameMatch}" non trovato in Excel')

    try:
        ws = wb.Sheets(req.sheetName)
    except Exception:
        raise HTTPException(status_code=422, detail=f'Foglio "{req.sheetName}" non trovato')

    ws.Cells.ClearContents()
    for r_idx, row in enumerate(req.rows, start=1):
        for c_idx, val in enumerate(row, start=1):
            ws.Cells(r_idx, c_idx).Value = val

    return {"ok": True, "rows_written": len(req.rows)}


# ── Nuovi endpoint ExpoList ──────────────────────────────────────────────────

@app.get("/expo-list-mtime")
def expo_list_mtime():
    """Ritorna la data di ultima modifica di tbl_ExpoList.xlsm."""
    if not EXPO_LIST_PATH.exists():
        return {"exists": False, "mtime": None, "path": str(EXPO_LIST_PATH)}
    mtime = datetime.fromtimestamp(EXPO_LIST_PATH.stat().st_mtime).isoformat()
    return {"exists": True, "mtime": mtime, "path": str(EXPO_LIST_PATH)}


@app.get("/expo-list-data")
def expo_list_data():
    """Legge il foglio EXPO da tbl_ExpoList.xlsm e ritorna lista {item_no, expo_type}."""
    if not EXPO_LIST_PATH.exists():
        raise HTTPException(status_code=404, detail=f"File non trovato: {EXPO_LIST_PATH}")

    try:
        wb = openpyxl.load_workbook(str(EXPO_LIST_PATH), read_only=True, data_only=True)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Errore apertura file: {e}")

    if "EXPO" not in wb.sheetnames:
        wb.close()
        raise HTTPException(status_code=422, detail='Foglio "EXPO" non trovato nel file')

    ws = wb["EXPO"]
    valid = {"TABLE", "WALL", "BUCKET"}
    items = []

    # Riga 1: metadato Power Query → skip
    # Riga 2: header (Item Number, EXPO) → skip
    # Dati da riga 3
    for row in ws.iter_rows(min_row=3, max_col=2, values_only=True):
        item_no  = row[0]
        expo_raw = row[1]
        if not item_no or not expo_raw:
            continue
        item_no_str = str(item_no).strip()
        expo_str    = str(expo_raw).strip().upper()
        if item_no_str and expo_str in valid:
            items.append({"item_no": item_no_str, "expo_type": expo_str})

    wb.close()
    return {"items": items, "count": len(items)}


# ── Endpoint ECO List ────────────────────────────────────────────────────────

@app.get("/eco-list-mtime")
def eco_list_mtime():
    """Ritorna la data di ultima modifica di tbl_ECO.xlsx."""
    if not ECO_LIST_PATH.exists():
        return {"exists": False, "mtime": None, "path": str(ECO_LIST_PATH)}
    mtime = datetime.fromtimestamp(ECO_LIST_PATH.stat().st_mtime).isoformat()
    return {"exists": True, "mtime": mtime, "path": str(ECO_LIST_PATH)}


@app.get("/eco-list-data")
def eco_list_data():
    """Legge il foglio Foglio1 da tbl_ECO.xlsx e ritorna lista di item_no ECO."""
    if not ECO_LIST_PATH.exists():
        raise HTTPException(status_code=404, detail=f"File non trovato: {ECO_LIST_PATH}")

    try:
        wb = openpyxl.load_workbook(str(ECO_LIST_PATH), read_only=True, data_only=True)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Errore apertura file: {e}")

    # Il file ha un solo foglio (Foglio1); usa il primo disponibile
    ws = wb.active
    items = []

    # Riga 1: header (Zebra, Eco) → skip; dati da riga 2
    for row in ws.iter_rows(min_row=2, max_col=1, values_only=True):
        item_no = row[0]
        if not item_no:
            continue
        item_no_str = str(item_no).strip()
        if item_no_str:
            items.append(item_no_str)

    wb.close()
    return {"items": items, "count": len(items)}


# ── Endpoint Eccezioni / BestSeller ─────────────────────────────────────────

@app.get("/eccezioni-mtime")
def eccezioni_mtime():
    """Ritorna la data di ultima modifica di tbl_Eccezioni.xlsm."""
    if not ECCEZIONI_LIST_PATH.exists():
        return {"exists": False, "mtime": None, "path": str(ECCEZIONI_LIST_PATH)}
    mtime = datetime.fromtimestamp(ECCEZIONI_LIST_PATH.stat().st_mtime).isoformat()
    return {"exists": True, "mtime": mtime, "path": str(ECCEZIONI_LIST_PATH)}


@app.get("/eccezioni-data")
def eccezioni_data():
    """Legge i fogli ECCEZIONI e BEST SELLER da tbl_Eccezioni.xlsm."""
    if not ECCEZIONI_LIST_PATH.exists():
        raise HTTPException(status_code=404, detail=f"File non trovato: {ECCEZIONI_LIST_PATH}")

    try:
        wb = openpyxl.load_workbook(str(ECCEZIONI_LIST_PATH), read_only=True, data_only=True)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Errore apertura file: {e}")

    # ── Foglio ECCEZIONI ──────────────────────────────────────────────────────
    # Riga 1: metadato Power Query → skip
    # Riga 2: header (ZEBRA, DESCRIZIONE, 1 PREZZO, 2 PREZZO, SCONTO, TESTO...) → skip
    # Dati da riga 3; colonne A-F (indici 0-5)
    eccezioni = []
    if "ECCEZIONI" in wb.sheetnames:
        ws_ecc = wb["ECCEZIONI"]
        for row in ws_ecc.iter_rows(min_row=3, max_col=12, values_only=True):
            zebra = row[0]
            if not zebra:
                continue
            zebra_str = str(zebra).strip()
            if not zebra_str:
                continue

            def _sv(v):
                return str(v).strip() if v is not None and str(v).strip() not in ("", "0.0", "None") else None

            def _fv(v):
                if v is None:
                    return None
                try:
                    return float(str(v).replace(",", "."))
                except (ValueError, TypeError):
                    return None

            eccezioni.append({
                "zebra":        zebra_str,
                "descrizione":  _sv(row[1]),
                "prezzo_1":     _fv(row[2]),
                "prezzo_2":     _fv(row[3]),
                "sconto":       _sv(row[4]),
                "testo_prezzo": _sv(row[5]),
                "categoria":    _sv(row[6]),
                "eccezione":    _sv(row[7]),
                "testo_prezzo2":_sv(row[8]),
                "col11":        _sv(row[9]),
                "col12":        _sv(row[10]),
            })

    # ── Foglio BEST SELLER ────────────────────────────────────────────────────
    # Riga 1: header (ITEM) → skip; dati da riga 2
    bestseller = []
    if "BEST SELLER" in wb.sheetnames:
        ws_bs = wb["BEST SELLER"]
        for row in ws_bs.iter_rows(min_row=2, max_col=1, values_only=True):
            item_no = row[0]
            if not item_no:
                continue
            item_no_str = str(item_no).strip()
            if item_no_str:
                bestseller.append({"item_no": item_no_str})

    wb.close()
    return {
        "eccezioni":  eccezioni,
        "bestseller": bestseller,
        "eccezioni_count":  len(eccezioni),
        "bestseller_count": len(bestseller),
    }


# ── Endpoint KGL (pesi corretti) ─────────────────────────────────────────────

@app.get("/kgl-mtime")
def kgl_mtime():
    """Ritorna la data di ultima modifica di tbl_KGL.xlsm."""
    if not KGL_LIST_PATH.exists():
        return {"exists": False, "mtime": None, "path": str(KGL_LIST_PATH)}
    mtime = datetime.fromtimestamp(KGL_LIST_PATH.stat().st_mtime).isoformat()
    return {"exists": True, "mtime": mtime, "path": str(KGL_LIST_PATH)}


@app.get("/kgl-data")
def kgl_data():
    """Legge il foglio KG-L da tbl_KGL.xlsm (col A = Nr., col D = PESO CORRETTO).

    Struttura: riga 1 = metadato Power Query, riga 2 = header, dati da riga 3.
    Solo righe con PESO CORRETTO numerico valido (> 0) vengono incluse.
    """
    if not KGL_LIST_PATH.exists():
        raise HTTPException(status_code=404, detail=f"File non trovato: {KGL_LIST_PATH}")

    try:
        wb = openpyxl.load_workbook(str(KGL_LIST_PATH), read_only=True, data_only=True)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Errore apertura file: {e}")

    if "KG-L" not in wb.sheetnames:
        wb.close()
        raise HTTPException(status_code=422, detail='Foglio "KG-L" non trovato nel file')

    ws = wb["KG-L"]
    items = []

    # Riga 1: metadato Power Query → skip
    # Riga 2: header (Nr., Descrizione, ..., PESO CORRETTO, ...) → skip
    # Dati da riga 3; col A = item_no, col D (indice 3) = peso_corretto
    for row in ws.iter_rows(min_row=3, max_col=4, values_only=True):
        item_no = row[0]
        peso    = row[3]
        if not item_no or peso is None:
            continue
        item_no_str = str(item_no).strip()
        if not item_no_str:
            continue
        try:
            peso_val = float(str(peso).replace(",", "."))
        except (ValueError, TypeError):
            continue
        if peso_val > 0:
            items.append({"item_no": item_no_str, "peso_corretto": peso_val})

    wb.close()
    return {"items": items, "count": len(items)}


# ── Entry point ──────────────────────────────────────────────────────────────

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=9999, log_level="warning")
