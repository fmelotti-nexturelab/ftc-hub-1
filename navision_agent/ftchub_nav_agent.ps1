# ============================================================
# FTC HUB - NAV Agent
# Ascolta su localhost:9999 e apre i file .rdp richiesti
# dall'app FTC HUB nel browser.
#
# Avvio in background: tramite FTCHubNavAgent.exe (wrapper C#)
# Avvio manuale (debug): powershell -ExecutionPolicy Bypass -File ftchub_nav_agent.ps1
# ============================================================

Add-Type -AssemblyName System.Windows.Forms

$PORT = 9999

# Origin consentite per richieste dal browser (CORS whitelist).
# Deve combaciare con allow_origins del backend FastAPI.
$ALLOWED_ORIGINS = @(
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://localhost",
    "https://127.0.0.1",
    "https://HO-SERVICES",
    "https://10.74.0.110",
    "https://hub.nexturelab.com"
)

# Win32 API per portare una finestra in primo piano (con workaround restrizioni Windows)
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class WinApi {
    [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
    [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
    [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);
    [DllImport("kernel32.dll")] public static extern uint GetCurrentThreadId();
    [DllImport("user32.dll")] public static extern bool AttachThreadInput(uint idAttach, uint idAttachTo, bool fAttach);
    [DllImport("user32.dll")] public static extern bool BringWindowToTop(IntPtr hWnd);
    public const int SW_RESTORE = 9;
    public const int SW_SHOW = 5;

    [DllImport("user32.dll")] public static extern bool MoveWindow(IntPtr hWnd, int X, int Y, int nWidth, int nHeight, bool bRepaint);
    [DllImport("user32.dll")] public static extern bool IsZoomed(IntPtr hWnd);

    public static void ForceForeground(IntPtr hWnd) {
        IntPtr fg = GetForegroundWindow();
        uint pid = 0;
        uint fgThread = GetWindowThreadProcessId(fg, out pid);
        uint curThread = GetCurrentThreadId();
        if (fgThread != curThread) {
            AttachThreadInput(curThread, fgThread, true);
            ShowWindow(hWnd, SW_RESTORE);
            BringWindowToTop(hWnd);
            SetForegroundWindow(hWnd);
            AttachThreadInput(curThread, fgThread, false);
        } else {
            ShowWindow(hWnd, SW_RESTORE);
            SetForegroundWindow(hWnd);
        }
    }
}
"@

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$PORT/")
$listener.Start()

Write-Host "FTC HUB NAV Agent avviato su http://localhost:$PORT/" -ForegroundColor Green
Write-Host "Premi Ctrl+C per fermare." -ForegroundColor Gray

# Applica header CORS alla risposta solo se l'Origin della richiesta e' whitelistata.
# Se l'Origin non e' presente (es. curl diretto, non browser) la funzione torna $true
# perche' il CORS protegge solo dalle richieste cross-origin del browser.
function Set-CorsHeaders {
    param($req, $res)
    $origin = $req.Headers["Origin"]
    if ([string]::IsNullOrEmpty($origin)) {
        return $true
    }
    if ($ALLOWED_ORIGINS -contains $origin) {
        $res.Headers.Add("Access-Control-Allow-Origin",  $origin)
        $res.Headers.Add("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        $res.Headers.Add("Access-Control-Allow-Headers", "Content-Type")
        $res.Headers.Add("Vary", "Origin")
        return $true
    }
    Write-Host "[WARN] Origin non consentita: $origin" -ForegroundColor Yellow
    return $false
}

function Write-JsonResponse {
    param($res, [int]$status, [string]$body)
    $res.StatusCode  = $status
    $res.ContentType = "application/json"
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($body)
    $res.OutputStream.Write($bytes, 0, $bytes.Length)
}

while ($listener.IsListening) {
    $ctx = $listener.GetContext()
    $req = $ctx.Request
    $res = $ctx.Response

    # CORS check: applica header o rifiuta
    $corsOk = Set-CorsHeaders -req $req -res $res
    if (-not $corsOk) {
        Write-JsonResponse -res $res -status 403 -body '{"error":"origin not allowed"}'
        $res.Close()
        continue
    }

    # Preflight CORS
    if ($req.HttpMethod -eq "OPTIONS") {
        $res.StatusCode = 200
        $res.Close()
        continue
    }

    if ($req.HttpMethod -eq "POST" -and $req.Url.LocalPath -eq "/open") {
        try {
            $reader = New-Object System.IO.StreamReader($req.InputStream, [System.Text.Encoding]::UTF8)
            $body   = $reader.ReadToEnd()
            $data   = $body | ConvertFrom-Json
            $path   = $data.path

            $ext = [System.IO.Path]::GetExtension($path).ToLower()

            if ($path -and ($ext -eq ".rdp") -and (Test-Path $path)) {
                Start-Process "mstsc.exe" -ArgumentList "`"$path`""
                Write-Host "[OK] Aperto: $path" -ForegroundColor Cyan
                Write-JsonResponse -res $res -status 200 -body '{"ok":true}'
            } else {
                Write-Host "[ERR] File non trovato: $path" -ForegroundColor Yellow
                Write-JsonResponse -res $res -status 404 -body '{"error":"file non trovato"}'
            }
        } catch {
            Write-Host "[ERR] $_" -ForegroundColor Red
            Write-JsonResponse -res $res -status 500 -body '{"error":"errore interno"}'
        }

    } elseif ($req.HttpMethod -eq "POST" -and $req.Url.LocalPath -eq "/focus") {
        # Porta la finestra mstsc piu' recente in primo piano (forza con AttachThreadInput)
        $procs = Get-Process -Name mstsc -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne [IntPtr]::Zero } | Sort-Object StartTime -Descending
        if ($procs) {
            $target = $procs[0]
            [WinApi]::ForceForeground($target.MainWindowHandle)
            Write-Host "[OK] Focus forzato su mstsc (PID $($target.Id))" -ForegroundColor Cyan
            Write-JsonResponse -res $res -status 200 -body '{"ok":true}'
        } else {
            Write-Host "[WARN] Nessuna finestra mstsc trovata" -ForegroundColor Yellow
            Write-JsonResponse -res $res -status 404 -body '{"error":"nessuna finestra mstsc"}'
        }

    } elseif ($req.HttpMethod -eq "POST" -and $req.Url.LocalPath -eq "/kill") {
        # Chiude tutte le sessioni mstsc e wksprt
        $killed = @()
        foreach ($name in @("mstsc", "wksprt")) {
            $procs = Get-Process -Name $name -ErrorAction SilentlyContinue
            foreach ($p in $procs) {
                try { $p.Kill(); $killed += "$name (PID $($p.Id))" } catch {}
            }
        }
        if ($killed.Count -gt 0) {
            Write-Host "[OK] Chiusi: $($killed -join ', ')" -ForegroundColor Cyan
            Write-JsonResponse -res $res -status 200 -body "{`"ok`":true,`"killed`":$($killed.Count)}"
        } else {
            Write-Host "[INFO] Nessuna sessione attiva" -ForegroundColor Gray
            Write-JsonResponse -res $res -status 200 -body '{"ok":true,"killed":0}'
        }

    } elseif ($req.HttpMethod -eq "POST" -and $req.Url.LocalPath -eq "/mail") {
        # Apre Outlook con mail HTML precompilata via COM Automation
        try {
            $reader = New-Object System.IO.StreamReader($req.InputStream, [System.Text.Encoding]::UTF8)
            $rawBody = $reader.ReadToEnd()
            $data = $rawBody | ConvertFrom-Json
            $subject = $data.subject
            $htmlBody = $data.html
            $to = if ($data.to) { $data.to } else { "" }

            $outlook = New-Object -ComObject Outlook.Application
            $mail = $outlook.CreateItem(0)
            $mail.Subject = $subject
            $mail.HTMLBody = $htmlBody
            if ($to) { $mail.To = $to }
            $mail.Display()

            # Porta la finestra Outlook in primo piano
            Start-Sleep -Milliseconds 500
            $olProc = Get-Process -Name OUTLOOK -ErrorAction SilentlyContinue |
                Where-Object { $_.MainWindowHandle -ne [IntPtr]::Zero } |
                Select-Object -First 1
            if ($olProc) {
                [WinApi]::ForceForeground($olProc.MainWindowHandle)
            }

            Write-Host "[OK] Mail Outlook aperta: $subject" -ForegroundColor Cyan
            Write-JsonResponse -res $res -status 200 -body '{"ok":true}'
        } catch {
            Write-Host "[ERR] Outlook COM fallito: $_" -ForegroundColor Red
            Write-JsonResponse -res $res -status 500 -body '{"error":"outlook failed"}'
        }

    } elseif ($req.HttpMethod -eq "POST" -and $req.Url.LocalPath -eq "/browse-folder") {
        # Apre un FolderBrowserDialog nativo Windows (nessuna restrizione su Desktop ecc.)
        try {
            $dlg = New-Object System.Windows.Forms.FolderBrowserDialog
            $dlg.Description = "Seleziona la cartella contenente i file .rdp"
            $dlg.RootFolder  = [System.Environment+SpecialFolder]::Desktop
            $dlg.ShowNewFolderButton = $false

            $result = $dlg.ShowDialog()
            if ($result -eq [System.Windows.Forms.DialogResult]::OK) {
                $selected = $dlg.SelectedPath
                Write-Host "[OK] Cartella selezionata: $selected" -ForegroundColor Cyan
                $escaped = $selected -replace '\\','\\'
                Write-JsonResponse -res $res -status 200 -body "{`"ok`":true,`"path`":`"$escaped`"}"
            } else {
                Write-Host "[INFO] Selezione cartella annullata" -ForegroundColor Gray
                Write-JsonResponse -res $res -status 200 -body '{"ok":false,"cancelled":true}'
            }
        } catch {
            Write-Host "[ERR] FolderBrowser: $_" -ForegroundColor Red
            Write-JsonResponse -res $res -status 500 -body '{"error":"folderbrowser failed"}'
        }

    } elseif ($req.HttpMethod -eq "GET" -and $req.Url.LocalPath -eq "/ping") {
        # Health check - usato dal browser per capire se l'agent e' attivo
        Write-JsonResponse -res $res -status 200 -body '{"ok":true}'

    } elseif ($req.HttpMethod -eq "POST" -and $req.Url.LocalPath -eq "/shutdown") {
        # Arresta l'agente in modo pulito
        Write-Host "[INFO] Shutdown richiesto dal browser - arresto in corso..." -ForegroundColor Yellow
        Write-JsonResponse -res $res -status 200 -body '{"ok":true,"message":"agent stopped"}'
        $res.Close()
        $listener.Stop()
        $listener.Close()
        Write-Host "[OK] Agente arrestato." -ForegroundColor Green
        exit 0

    } else {
        $res.StatusCode = 404
    }

    $res.Close()
}
