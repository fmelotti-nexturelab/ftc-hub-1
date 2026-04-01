# ============================================================
# FTC HUB - NAV Agent
# Ascolta su localhost:9999 e apre i file .rdp richiesti
# dall'app FTC HUB nel browser.
#
# Avvio manuale:  powershell -ExecutionPolicy Bypass -File ftchub_nav_agent.ps1
# Avvio nascosto: usare installa_agente.bat
# ============================================================

Add-Type -AssemblyName System.Windows.Forms

$PORT = 9999

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

while ($listener.IsListening) {
    $ctx = $listener.GetContext()
    $req = $ctx.Request
    $res = $ctx.Response

    # CORS — accetta richieste dal browser
    $res.Headers.Add("Access-Control-Allow-Origin",  "*")
    $res.Headers.Add("Access-Control-Allow-Methods", "POST, OPTIONS")
    $res.Headers.Add("Access-Control-Allow-Headers", "Content-Type")
    $res.ContentType = "application/json"

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
                $body = '{"ok":true}'
                $res.StatusCode = 200
            } else {
                Write-Host "[ERR] File non trovato: $path" -ForegroundColor Yellow
                $body = '{"error":"file non trovato"}'
                $res.StatusCode = 404
            }
        } catch {
            Write-Host "[ERR] $_" -ForegroundColor Red
            $body = '{"error":"errore interno"}'
            $res.StatusCode = 500
        }

        $bytes = [System.Text.Encoding]::UTF8.GetBytes($body)
        $res.OutputStream.Write($bytes, 0, $bytes.Length)

    } elseif ($req.HttpMethod -eq "POST" -and $req.Url.LocalPath -eq "/focus") {
        # Porta la finestra mstsc più recente in primo piano (forza con AttachThreadInput)
        $procs = Get-Process -Name mstsc -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne [IntPtr]::Zero } | Sort-Object StartTime -Descending
        if ($procs) {
            $target = $procs[0]
            [WinApi]::ForceForeground($target.MainWindowHandle)
            Write-Host "[OK] Focus forzato su mstsc (PID $($target.Id))" -ForegroundColor Cyan
            $body = '{"ok":true}'
            $res.StatusCode = 200
        } else {
            Write-Host "[WARN] Nessuna finestra mstsc trovata" -ForegroundColor Yellow
            $body = '{"error":"nessuna finestra mstsc"}'
            $res.StatusCode = 404
        }
        $bytes = [System.Text.Encoding]::UTF8.GetBytes($body)
        $res.OutputStream.Write($bytes, 0, $bytes.Length)

    } elseif ($req.HttpMethod -eq "POST" -and $req.Url.LocalPath -eq "/snap") {
        # Affianca browser (sinistra) e mstsc (destra)
        $sw = [System.Windows.Forms.Screen]::PrimaryScreen.WorkingArea.Width
        $sh = [System.Windows.Forms.Screen]::PrimaryScreen.WorkingArea.Height
        $half = [math]::Round($sw / 2)

        # Trova finestra browser (Chrome o Edge)
        $browser = Get-Process -Name chrome, msedge -ErrorAction SilentlyContinue |
            Where-Object { $_.MainWindowHandle -ne [IntPtr]::Zero -and $_.MainWindowTitle -match "FTC|HUB|Navision|localhost" } |
            Select-Object -First 1
        if ($browser) {
            [WinApi]::ShowWindow($browser.MainWindowHandle, [WinApi]::SW_RESTORE) | Out-Null
            [WinApi]::MoveWindow($browser.MainWindowHandle, 0, 0, $half, $sh, $true) | Out-Null
            Write-Host "[OK] Browser snappato a sinistra" -ForegroundColor Cyan
        }

        # Trova mstsc
        $mstsc = Get-Process -Name mstsc -ErrorAction SilentlyContinue |
            Where-Object { $_.MainWindowHandle -ne [IntPtr]::Zero } |
            Sort-Object StartTime -Descending | Select-Object -First 1
        if ($mstsc) {
            [WinApi]::ShowWindow($mstsc.MainWindowHandle, [WinApi]::SW_RESTORE) | Out-Null
            [WinApi]::MoveWindow($mstsc.MainWindowHandle, $half, 0, ($sw - $half), $sh, $true) | Out-Null
            [WinApi]::ForceForeground($mstsc.MainWindowHandle)
            Write-Host "[OK] mstsc snappato a destra" -ForegroundColor Cyan
        }

        $body = '{"ok":true}'
        $res.StatusCode = 200
        $bytes = [System.Text.Encoding]::UTF8.GetBytes($body)
        $res.OutputStream.Write($bytes, 0, $bytes.Length)

    } elseif ($req.HttpMethod -eq "POST" -and $req.Url.LocalPath -eq "/restore") {
        # Rimassimizza il browser
        $browser = Get-Process -Name chrome, msedge -ErrorAction SilentlyContinue |
            Where-Object { $_.MainWindowHandle -ne [IntPtr]::Zero -and $_.MainWindowTitle -match "FTC|HUB|Navision|localhost" } |
            Select-Object -First 1
        if ($browser) {
            [WinApi]::ShowWindow($browser.MainWindowHandle, 3) | Out-Null  # SW_MAXIMIZE = 3
            [WinApi]::ForceForeground($browser.MainWindowHandle)
            Write-Host "[OK] Browser rimassimizzato" -ForegroundColor Cyan
            $body = '{"ok":true}'
            $res.StatusCode = 200
        } else {
            $body = '{"error":"browser non trovato"}'
            $res.StatusCode = 404
        }
        $bytes = [System.Text.Encoding]::UTF8.GetBytes($body)
        $res.OutputStream.Write($bytes, 0, $bytes.Length)

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
            $body = "{`"ok`":true,`"killed`":$($killed.Count)}"
        } else {
            Write-Host "[INFO] Nessuna sessione attiva" -ForegroundColor Gray
            $body = '{"ok":true,"killed":0}'
        }
        $res.StatusCode = 200
        $bytes = [System.Text.Encoding]::UTF8.GetBytes($body)
        $res.OutputStream.Write($bytes, 0, $bytes.Length)

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
            $body = '{"ok":true}'
            $res.StatusCode = 200
        } catch {
            Write-Host "[ERR] Outlook COM fallito: $_" -ForegroundColor Red
            $body = "{`"error`":`"$($_.Exception.Message)`"}"
            $res.StatusCode = 500
        }
        $bytes = [System.Text.Encoding]::UTF8.GetBytes($body)
        $res.OutputStream.Write($bytes, 0, $bytes.Length)

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
                $body = "{`"ok`":true,`"path`":`"$($selected -replace '\\','\\')`"}"
                $res.StatusCode = 200
            } else {
                Write-Host "[INFO] Selezione cartella annullata" -ForegroundColor Gray
                $body = '{"ok":false,"cancelled":true}'
                $res.StatusCode = 200
            }
        } catch {
            Write-Host "[ERR] FolderBrowser: $_" -ForegroundColor Red
            $body = "{`"error`":`"$($_.Exception.Message)`"}"
            $res.StatusCode = 500
        }
        $bytes = [System.Text.Encoding]::UTF8.GetBytes($body)
        $res.OutputStream.Write($bytes, 0, $bytes.Length)

    } elseif ($req.HttpMethod -eq "GET" -and $req.Url.LocalPath -eq "/ping") {
        # Health check — usato dal browser per capire se l'agent è attivo
        $bytes = [System.Text.Encoding]::UTF8.GetBytes('{"ok":true}')
        $res.StatusCode = 200
        $res.OutputStream.Write($bytes, 0, $bytes.Length)

    } elseif ($req.HttpMethod -eq "POST" -and $req.Url.LocalPath -eq "/shutdown") {
        # Arresta l'agente in modo pulito
        Write-Host "[INFO] Shutdown richiesto dal browser — arresto in corso…" -ForegroundColor Yellow
        $bytes = [System.Text.Encoding]::UTF8.GetBytes('{"ok":true,"message":"agent stopped"}')
        $res.StatusCode = 200
        $res.OutputStream.Write($bytes, 0, $bytes.Length)
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
