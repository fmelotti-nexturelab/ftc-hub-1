// ============================================================
// FTC HUB - NAV Agent Launcher (wrapper C#)
//
// Eseguibile WinExe (nessuna finestra console) che lancia
// ftchub_nav_agent.ps1 in PowerShell nascosto.
//
// Cerca lo script .ps1 nella stessa cartella dell'eseguibile.
// In Task Manager compare come FTCHubNavAgent.exe, non come
// powershell.exe, ed e' piu' facile da riconoscere per l'IT.
//
// Compilazione (Framework .NET gia' presente in Windows):
//   csc /target:winexe /out:FTCHubNavAgent.exe FTCHubNavAgent.cs
// ============================================================

using System;
using System.Diagnostics;
using System.IO;
using System.Reflection;

namespace FTCHub
{
    internal static class NavAgentLauncher
    {
        private const string ScriptName = "ftchub_nav_agent.ps1";

        [STAThread]
        private static int Main()
        {
            try
            {
                string exePath   = Assembly.GetExecutingAssembly().Location;
                string exeDir    = Path.GetDirectoryName(exePath) ?? ".";
                string scriptPath = Path.Combine(exeDir, ScriptName);

                if (!File.Exists(scriptPath))
                {
                    // Nessun UI: scriviamo su Event Log applicazione in modo best-effort
                    TryLogError("Script non trovato: " + scriptPath);
                    return 2;
                }

                var psi = new ProcessStartInfo
                {
                    FileName               = "powershell.exe",
                    Arguments              = "-NoProfile -ExecutionPolicy Bypass -File \"" + scriptPath + "\"",
                    UseShellExecute        = false,
                    CreateNoWindow         = true,
                    WindowStyle            = ProcessWindowStyle.Hidden,
                    WorkingDirectory       = exeDir,
                    RedirectStandardOutput = false,
                    RedirectStandardError  = false,
                };

                Process.Start(psi);
                return 0;
            }
            catch (Exception ex)
            {
                TryLogError("Avvio fallito: " + ex.Message);
                return 1;
            }
        }

        private static void TryLogError(string message)
        {
            try
            {
                const string source = "FTCHubNavAgent";
                if (!EventLog.SourceExists(source))
                {
                    EventLog.CreateEventSource(source, "Application");
                }
                EventLog.WriteEntry(source, message, EventLogEntryType.Error);
            }
            catch
            {
                // Event log puo' fallire se l'utente non ha i permessi per creare la source.
                // In quel caso non abbiamo canali migliori: l'agent semplicemente non parte.
            }
        }
    }
}
