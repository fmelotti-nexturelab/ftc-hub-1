import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { useAuthStore } from "@/store/authStore"
import { ClipboardCheck, Printer, RotateCcw, LogOut } from "lucide-react"

const ALLOWED_TYPES = ["IT", "SUPERUSER", "ADMIN"]

const SECTIONS = [
  {
    title: "1. Accesso e Permessi",
    items: [
      "Login come STORE/STOREMANAGER → vede solo i propri ticket",
      "Login come IT/HO → vede tutti i ticket con filtri avanzati",
      "Login come SUPERUSER → vede tutto incluse le statistiche",
      "Utente non autorizzato → redirect corretto a pagina Unauthorized",
    ],
  },
  {
    title: "2. Creazione Ticket",
    items: [
      "Form di creazione accessibile dal menu Ticket → Nuovo",
      "Campi obbligatori validati (titolo, descrizione, categoria)",
      "Dati richiedente pre-compilati automaticamente",
      "AI enhancement della descrizione funzionante (o fallback silenzioso)",
      "Ticket creato con numero progressivo corretto",
      "Store number auto-popolato per utenti STOREMANAGER",
      "Routing automatico assegna al team corretto per categoria",
      "Notifica in-app ricevuta dagli utenti IT/SUPERUSER alla creazione",
    ],
  },
  {
    title: "3. Lista Ticket",
    items: [
      "Lista ticket si carica correttamente",
      "Filtro per stato funzionante (Aperto, In lavorazione, In attesa, Risolto)",
      "Filtro per priorità funzionante",
      "Filtro per categoria funzionante",
      "Filtro per team funzionante (solo manager)",
      "Selezione multipla ticket con checkbox",
      "Bulk action: chiudi selezionati",
      "Bulk action: cambia stato selezionati",
      "Bulk action: assegna selezionati",
    ],
  },
  {
    title: "4. Dettaglio Ticket",
    items: [
      "Apertura dettaglio ticket funzionante",
      "Informazioni ticket visualizzate correttamente",
      "Cambio stato funzionante (solo manager)",
      "Assegnazione ticket a utente (solo manager)",
      'Pulsante "Prendi in carico" funzionante (solo manager)',
      "Taken_at e resolution_minutes calcolati correttamente alla chiusura",
      "Commenti pubblici visibili a tutti",
      "Note interne visibili solo ai manager",
      "Aggiunta commento pubblico funzionante",
      "Aggiunta nota interna funzionante (solo manager)",
      "Upload allegato (JPG, PNG, PDF — max 5MB)",
      "Download allegato funzionante",
      "Notifica in-app al cambio stato ricevuta dall'autore del ticket",
      "Notifica in-app su nuovo commento ricevuta dal destinatario",
    ],
  },
  {
    title: "5. Storico Ticket",
    items: [
      "Pagina storico accessibile dal menu",
      "Lista ticket chiusi visualizzata correttamente",
      "Filtro per priorità funzionante",
      "Filtro per categoria funzionante",
      "Filtro per team funzionante (solo SUPERUSER)",
      "Tempo di risoluzione visualizzato correttamente",
      "Link apertura ticket dal dettaglio storico funzionante",
    ],
  },
  {
    title: "6. Dashboard Statistiche",
    items: [
      "Accesso alla dashboard (solo manager)",
      "Totali per stato visualizzati correttamente",
      "Statistiche per team aggiornate",
      "Statistiche per categoria aggiornate",
      "Classifica chiusure per assegnatario (solo SUPERUSER)",
    ],
  },
  {
    title: "7. Sistema Notifiche In-App",
    items: [
      "Campanella visibile nell'header per tutti gli utenti",
      "Badge numerico rosso compare su nuovo ticket (per IT/SUPERUSER)",
      "Badge numerico si aggiorna ogni 30 secondi (polling)",
      "Pannello notifiche si apre al click sulla campanella",
      "Tab 'Tutte' mostra tutte le notifiche",
      "Tab 'Tickets' filtra solo le notifiche ticket",
      "Indicatore blu su notifiche non lette",
      "Click su notifica naviga al ticket corretto",
      "Click su notifica la segna come letta",
      '"Segna tutte lette" funzionante',
      "Badge si azzera quando non ci sono notifiche non lette",
      "Chiusura pannello cliccando fuori funzionante",
    ],
  },
  {
    title: "8. PWA — Installazione",
    items: [
      "Manifest.json caricato (F12 → Application → Manifest)",
      "Icona e nome FTC HUB visibili nel manifest",
      'App installabile da Edge (icona "+" nella barra indirizzi o menu ···)',
      "App si apre senza barra browser dopo installazione",
      "Icona FTC HUB visibile nella taskbar Windows",
      "Badge numerico visibile sull'icona nella taskbar",
      "Badge si aggiorna correttamente al polling",
    ],
  },
]

export default function TicketChecklist() {
  const user = useAuthStore((s) => s.user)
  const navigate = useNavigate()

  if (!ALLOWED_TYPES.includes(user?.department)) {
    navigate("/unauthorized", { replace: true })
    return null
  }

  const totalItems = SECTIONS.reduce((acc, s) => acc + s.items.length, 0)
  const [checked, setChecked] = useState({})

  const toggle = (key) => setChecked((prev) => ({ ...prev, [key]: !prev[key] }))
  const reset = () => setChecked({})

  const checkedCount = Object.values(checked).filter(Boolean).length
  const pct = Math.round((checkedCount / totalItems) * 100)

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-[#1e3a5f]/10 rounded-xl flex items-center justify-center">
            <ClipboardCheck size={18} className="text-[#1e3a5f]" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-800">Checklist Test — Sistema Ticket</h1>
            <p className="text-xs text-gray-400 mt-0.5">Verifica funzionalità prima del rilascio in produzione</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={reset}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition px-3 py-1.5 border border-gray-200 rounded-lg"
          >
            <RotateCcw size={13} />
            Reset
          </button>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 text-xs bg-[#1e3a5f] hover:bg-[#2563eb] text-white font-semibold px-4 py-1.5 rounded-xl shadow transition"
          >
            <Printer size={13} />
            Stampa
          </button>
          <button
            onClick={() => navigate("/utilities")}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition"
          >
            <LogOut size={15} />
            Esci
          </button>
        </div>
      </div>

      {/* Progress */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-gray-600">Avanzamento test</span>
          <span className="text-xs font-bold text-[#1e3a5f]">{checkedCount} / {totalItems} ({pct}%)</span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-2">
          <div
            className="bg-[#1e3a5f] h-2 rounded-full transition-all duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Sezioni */}
      {SECTIONS.map((section) => {
        const sectionChecked = section.items.filter((_, i) => checked[`${section.title}-${i}`]).length
        return (
          <div key={section.title} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="bg-[#1e3a5f] px-4 py-2.5 flex items-center justify-between">
              <span className="text-white text-xs font-bold">{section.title}</span>
              <span className="text-white/60 text-xs">{sectionChecked}/{section.items.length}</span>
            </div>
            <div className="divide-y divide-gray-50">
              {section.items.map((item, i) => {
                const key = `${section.title}-${i}`
                const isChecked = !!checked[key]
                return (
                  <label
                    key={key}
                    className="flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50/60 transition"
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggle(key)}
                      className="mt-0.5 w-4 h-4 rounded accent-[#1e3a5f] cursor-pointer shrink-0"
                    />
                    <span className={`text-xs leading-relaxed ${isChecked ? "line-through text-gray-300" : "text-gray-700"}`}>
                      {item}
                    </span>
                  </label>
                )
              })}
            </div>
          </div>
        )
      })}

      {/* Print styles */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .space-y-5, .space-y-5 * { visibility: visible; }
          .space-y-5 { position: absolute; top: 0; left: 0; width: 100%; }
          button { display: none !important; }
        }
      `}</style>
    </div>
  )
}
