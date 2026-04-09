#!/usr/bin/env python3
"""
FTC HUB — Stress Test Modulo Ticketing
========================================
Scenari:
  A) 2000 ticket in 1 ora (sustained load) con 5-6 commenti + allegati 1MB
  B) 200 ticket simultanei (spike)
  C) 50 utenti simultanei con operazioni miste (creazione + cambio stato)

Uso:   python stress_test_tickets.py
Requisiti: pip install httpx

Il report HTML viene salvato in stress_test_report.html
"""

import asyncio
import httpx
import time
import random
import statistics
import sys
import os
from datetime import datetime
from collections import defaultdict
from pathlib import Path

# ═══════════════════════════════════════════════════════════════════
# CONFIGURAZIONE
# ═══════════════════════════════════════════════════════════════════

BASE_URL = "https://hub.tigeritalia.com"
PASSWORD = "123"
VERIFY_SSL = False

# Scenario A: sustained load
SA_TOTAL_TICKETS = 2000
SA_DURATION_SEC = 3600  # 1 ora
SA_COMMENTS_RANGE = (5, 6)
SA_ATTACHMENTS_RANGE = (5, 6)
SA_ATTACHMENT_SIZE = 1 * 1024 * 1024  # 1 MB

# Scenario B: spike
SB_SIMULTANEOUS = 200

# Scenario C: mixed workload
SC_CONCURRENT_USERS = 50
SC_DURATION_SEC = 300  # 5 minuti

# Scenario D: AI routing (analyze + create)
SD_TOTAL_TICKETS = 400
SD_CONCURRENCY = 5  # basso per non sovraccaricare l'API AI

# Concurrency limits
MAX_CONCURRENT_REQUESTS = 30
HTTP_TIMEOUT = 60.0

# ═══════════════════════════════════════════════════════════════════
# DATI FINTI PER I TICKET
# ═══════════════════════════════════════════════════════════════════

TICKET_SCENARIOS = [
    # ── IT ──────────────────────────────────────────────────────────────────────
    ("PC non si accende", "Ho premuto il pulsante di accensione ma il PC non dà segni di vita. La spia di alimentazione non si accende."),
    ("Stampante non funziona", "La stampante termica della cassa non emette più scontrini. La carta c'è ma esce bianca."),
    ("Errore login POS", "Quando provo ad accedere al POS con le mie credenziali compare 'Errore di autenticazione'."),
    ("Scanner codici a barre rotto", "Lo scanner non riesce a leggere nessun codice. Ho provato con codici diversi e a pulire la lente."),
    ("WiFi non disponibile", "Da ieri il WiFi del negozio non funziona. I dispositivi vedono la rete ma non si connettono."),
    ("Problema email aziendale", "Non ricevo email da circa 3 ore. L'invio funziona ma la ricezione no."),
    ("VPN si disconnette spesso", "La connessione VPN cade continuamente, circa ogni 5 minuti. Impossibile lavorare da remoto."),
    ("PC molto lento", "Il PC è diventato lentissimo dopo l'aggiornamento di Windows. Ci mette 10 minuti per avviarsi."),
    ("Richiesta reset password", "Ho dimenticato la password del mio account aziendale e dopo 3 tentativi l'account si è bloccato."),
    ("POS non legge carte contactless", "La cassa si blocca quando il cliente prova a pagare con carta contactless."),
    ("Errore stampa etichette", "Le etichette prezzi escono storte e con il testo tagliato dalla stampante."),
    ("Teams non funziona", "Microsoft Teams si blocca sulla schermata di caricamento. Ho reinstallato ma non cambia."),
    ("Richiesta installazione software", "Avrei bisogno di installare un nuovo software sul mio PC per la gestione ordini."),
    ("Problema connessione NAV", "Navision mostra errore di connessione al database. Nessuno riesce ad accedere."),
    ("Monitor nero", "Il monitor della postazione 2 non si accende. Ho verificato i cavi e sembra tutto collegato."),
    # ── HR ──────────────────────────────────────────────────────────────────────
    ("Richiesta busta paga", "Non ho ricevuto la busta paga di questo mese. Potete verificare?"),
    ("Domanda su TFR", "Vorrei sapere a quanto ammonta il mio TFR maturato e le modalità di anticipo."),
    ("Richiesta ferie", "Vorrei richiedere 3 giorni di ferie dal 15 al 17 del prossimo mese per motivi personali."),
    ("Problema con straordinari", "Le ore di straordinario del mese scorso non risultano in busta paga. Ho fatto 12 ore extra."),
    ("Cambio turno", "Avrei bisogno di cambiare il turno di giovedì prossimo con un collega. Come devo fare?"),
    ("Richiesta permesso", "Ho bisogno di un permesso per visita medica venerdì mattina. Allego il certificato."),
    ("Errore in busta paga", "Nella busta paga di marzo manca il bonus vendite che mi spettava. Importo previsto 150 euro."),
    ("Contratto da rinnovare", "Il mio contratto a tempo determinato scade il mese prossimo. Vorrei sapere se verrà rinnovato."),
    ("Richiesta maternità", "Sono in attesa e devo comunicare le date previste per il congedo di maternità."),
    ("Infortunio sul lavoro", "Mi sono fatto male alla schiena sollevando uno scatolone. Ho bisogno della procedura per infortunio."),
    # ── HEALTH & SAFETY ────────────────────────────────────────────────────────
    ("Richiesta DPI", "Abbiamo bisogno di nuovi guanti da lavoro e scarpe antinfortunistiche per 3 dipendenti."),
    ("Segnalazione pavimento scivoloso", "Il pavimento davanti all'ingresso è molto scivoloso quando piove. Rischio cadute per clienti e personale."),
    ("Problema estintore", "L'estintore vicino alla cassa è scaduto da 2 mesi. Serve la sostituzione o la revisione."),
    ("Uscita emergenza bloccata", "La porta dell'uscita di emergenza sul retro non si apre. Serve intervento urgente."),
    ("Segnalazione muffa", "C'è della muffa nel bagno del personale, sulla parete dietro il lavandino. Serve bonifica."),
    ("Cassetta primo soccorso vuota", "La cassetta di primo soccorso è quasi vuota. Mancano cerotti, garze e disinfettante."),
    ("Richiesta visita medica lavoro", "Devo fare la visita medica periodica. L'ultima risale a più di un anno fa."),
    ("Allergene non segnalato", "Un prodotto in vendita contiene un allergene non indicato sull'etichetta italiana."),
    ("Temperatura negozio troppo alta", "La temperatura in negozio supera i 30 gradi. L'aria condizionata non funziona e i clienti si lamentano."),
    ("Scaffale instabile", "Uno scaffale nel reparto accessori oscilla quando lo si tocca. Rischio caduta prodotti sui clienti."),
    # ── RETAIL ──────────────────────────────────────────────────────────────────
    ("Reso merce danneggiata", "Un cliente vuole rendere un prodotto rotto acquistato ieri. Il prodotto è un set di bicchieri."),
    ("Planogramma non arrivato", "Non abbiamo ricevuto il planogramma aggiornato per il cambio vetrina di questa settimana."),
    ("Prodotto esaurito richiesto", "I clienti chiedono continuamente il portachiavi tigre che è esaurito da 2 settimane."),
    ("Errore prezzo a scaffale", "Il prezzo a scaffale del prodotto 5710000123 non corrisponde a quello in cassa. Differenza di 2 euro."),
    ("Problema allestimento vetrina", "Le istruzioni per l'allestimento vetrina di Pasqua non sono chiare. Manca la foto del layout."),
    ("Merce arrivata danneggiata", "La consegna di oggi ha 3 colli visibilmente danneggiati. Prodotti rotti all'interno."),
    ("Richiesta trasferimento merce", "Abbiamo troppo stock del prodotto natalizio. Possiamo trasferirlo al negozio vicino?"),
    ("Cliente reclamo", "Un cliente si è lamentato perché un prodotto acquistato una settimana fa si è già rotto. Vuole il rimborso."),
    ("Inventario non quadra", "L'inventario di fine mese mostra una differenza di 45 pezzi sul reparto cancelleria."),
    ("Prodotto ritirato dal mercato", "Ho visto online che il prodotto 5710000456 è stato ritirato per sicurezza. Lo abbiamo ancora a scaffale."),
    # ── COMMERCIAL ──────────────────────────────────────────────────────────────
    ("Ordine non arrivato", "L'ordine della settimana scorsa non è ancora arrivato. Il tracking mostra 'in transito' da 5 giorni."),
    ("Errore nel listino prezzi", "Il listino prezzi aggiornato ha dei prezzi diversi da quelli comunicati via email."),
    ("Richiesta campioni nuova collezione", "Vorremmo ricevere i campioni della nuova collezione estiva per la presentazione al DM."),
    ("Promozione non attiva in cassa", "La promozione 2x1 sui prodotti estivi non risulta attiva nel sistema POS."),
    ("Fornitore non consegna", "Il fornitore dei sacchetti biodegradabili non ha rispettato la data di consegna per la seconda volta."),
    ("Richiesta cambio prezzi", "Dobbiamo aggiornare i prezzi di 15 articoli per allinearli al nuovo listino europeo."),
    # ── MARKETING ───────────────────────────────────────────────────────────────
    ("Materiale POP non arrivato", "Il materiale promozionale per la campagna di primavera non è arrivato. L'evento è tra 3 giorni."),
    ("Errore su volantino", "Il volantino stampato ha un errore di prezzo sulla copertina. Il prezzo corretto è 3.99 non 9.99."),
    ("Richiesta foto negozio", "Il team marketing chiede foto del negozio dopo il restyling per i social media."),
    ("Problema insegna esterna", "Una delle lettere dell'insegna luminosa esterna si è spenta. Si legge 'FLYIN TIGER'."),
    ("Evento in negozio", "Vorremmo organizzare un evento per bambini sabato prossimo. Serve approvazione e materiale."),
    ("Social media - commento negativo", "Un cliente ha lasciato una recensione molto negativa su Google Maps. Come dobbiamo rispondere?"),
    # ── FACILITIES ──────────────────────────────────────────────────────────────
    ("Luci reparto rotte", "Due neon nel reparto giocattoli sono fulminati. Il reparto è buio e poco invitante per i clienti."),
    ("Bagno clienti guasto", "Il WC del bagno clienti non scarica. Serve idraulico urgente."),
    ("Problema climatizzazione", "Il riscaldamento non funziona. La temperatura in negozio è scesa sotto i 15 gradi."),
    ("Serratura porta magazzino", "La serratura della porta del magazzino si è bloccata. Non riusciamo ad accedere alla merce."),
    ("Allarme antifurto difettoso", "L'allarme antifurto suona ogni volta che un cliente passa anche senza prodotti. Imbarazzante."),
    ("Infiltrazione acqua", "C'è un'infiltrazione d'acqua dal soffitto vicino alla cassa 2. Quando piove gocciola sul pavimento."),
    ("Pulizia straordinaria", "Serve una pulizia straordinaria del negozio dopo l'evento di ieri sera. Pavimento molto sporco."),
    ("Porta automatica bloccata", "La porta automatica all'ingresso non si apre più. I clienti devono entrare dalla porta di sicurezza."),
    ("Ascensore fuori servizio", "L'ascensore del centro commerciale che porta al nostro piano è fermo da 2 giorni. Accessibilità compromessa."),
    # ── FINANCE ─────────────────────────────────────────────────────────────────
    ("Differenza di cassa", "Alla chiusura di ieri c'è una differenza di cassa di -35 euro. Non riusciamo a capire dove."),
    ("Richiesta nota spese", "Devo presentare la nota spese per il viaggio a Milano della settimana scorsa. Qual è la procedura?"),
    ("Fattura fornitore errata", "La fattura del fornitore XYZ ha un importo diverso da quello dell'ordine. Differenza di 200 euro."),
    ("Problema con il fondo cassa", "Il fondo cassa di apertura non corrisponde a quello di chiusura di ieri. Mancano 50 euro."),
    ("Rimborso cliente", "Un cliente ha diritto a un rimborso di 25 euro per un prodotto difettoso. Come procedo?"),
    ("Richiesta budget per evento", "Abbiamo bisogno di un budget di 500 euro per l'evento di inaugurazione del mese prossimo."),
]

TICKET_TITLES = [t[0] for t in TICKET_SCENARIOS]

TICKET_DESCRIPTIONS = [t[1] for t in TICKET_SCENARIOS]

# ═══════════════════════════════════════════════════════════════════
# MAPPATURA SCENARIO → CATEGORIA / SUBCATEGORIA
# Ogni titolo viene associato alla categoria e subcategoria corretta
# così il routing assegna il ticket al team giusto.
# ═══════════════════════════════════════════════════════════════════

SCENARIO_CATEGORY_MAP = {
    # ── IT ──
    "PC non si accende":                ("IT", "Hardware"),
    "Stampante non funziona":           ("IT", "Casse / POS / Stampanti Fiscali / Misuratore Fiscale / Scanner"),
    "Errore login POS":                 ("IT", "Casse / POS / Stampanti Fiscali / Misuratore Fiscale / Scanner"),
    "Scanner codici a barre rotto":     ("IT", "Casse / POS / Stampanti Fiscali / Misuratore Fiscale / Scanner"),
    "WiFi non disponibile":             ("IT", "Rete & Connettività"),
    "Problema email aziendale":         ("IT", "Software & Sistemi"),
    "VPN si disconnette spesso":        ("IT", "Rete & Connettività"),
    "PC molto lento":                   ("IT", "Hardware"),
    "Richiesta reset password":         ("IT", "Software & Sistemi"),
    "POS non legge carte contactless":  ("IT", "Casse / POS / Stampanti Fiscali / Misuratore Fiscale / Scanner"),
    "Errore stampa etichette":          ("IT", "Casse / POS / Stampanti Fiscali / Misuratore Fiscale / Scanner"),
    "Teams non funziona":               ("IT", "Software & Sistemi"),
    "Richiesta installazione software": ("IT", "Software & Sistemi"),
    "Problema connessione NAV":         ("IT", "Software & Sistemi"),
    "Monitor nero":                     ("IT", "Hardware"),
    # ── HR ──
    "Richiesta busta paga":             ("HR", "Buste Paga & Amministrazione"),
    "Domanda su TFR":                   ("HR", "Buste Paga & Amministrazione"),
    "Richiesta ferie":                  ("HR", "Presenze & Turni"),
    "Problema con straordinari":        ("HR", "Presenze & Turni"),
    "Cambio turno":                     ("HR", "Presenze & Turni"),
    "Richiesta permesso":               ("HR", "Presenze & Turni"),
    "Errore in busta paga":             ("HR", "Buste Paga & Amministrazione"),
    "Contratto da rinnovare":           ("HR", "Onboarding / Offboarding"),
    "Richiesta maternità":              ("HR", "Malattie & Congedi"),
    "Infortunio sul lavoro":            ("HR", "Malattie & Congedi"),
    # ── HEALTH & SAFETY ──
    "Richiesta DPI":                    ("HEALTH & SAFETY", "DPI & Normativa"),
    "Segnalazione pavimento scivoloso": ("HEALTH & SAFETY", "Segnalazione Incidente"),
    "Problema estintore":               ("HEALTH & SAFETY", "Sicurezza Struttura"),
    "Uscita emergenza bloccata":        ("HEALTH & SAFETY", "Sicurezza Struttura"),
    "Segnalazione muffa":               ("HEALTH & SAFETY", "Segnalazione Incidente"),
    "Cassetta primo soccorso vuota":    ("HEALTH & SAFETY", "DPI & Normativa"),
    "Richiesta visita medica lavoro":   ("HEALTH & SAFETY", "DPI & Normativa"),
    "Allergene non segnalato":          ("HEALTH & SAFETY", "Segnalazione Incidente"),
    "Temperatura negozio troppo alta":  ("HEALTH & SAFETY", "Sicurezza Struttura"),
    "Scaffale instabile":               ("HEALTH & SAFETY", "Sicurezza Struttura"),
    # ── RETAIL ──
    "Reso merce danneggiata":           ("RETAIL", "Apertura / Chiusura Negozio"),
    "Planogramma non arrivato":         ("RETAIL", "Display & Allestimento"),
    "Prodotto esaurito richiesto":      ("RETAIL", "Display & Allestimento"),
    "Errore prezzo a scaffale":         ("COMMERCIAL", "Prezzi stampa etichette"),
    "Problema allestimento vetrina":    ("RETAIL", "Display & Allestimento"),
    "Merce arrivata danneggiata":       ("COMMERCIAL", "Disservizi corriere"),
    "Richiesta trasferimento merce":    ("COMMERCIAL", "Trasferimento Interno"),
    "Cliente reclamo":                  ("RETAIL", "Apertura / Chiusura Negozio"),
    "Inventario non quadra":            ("RETAIL", "Apertura / Chiusura Negozio"),
    "Prodotto ritirato dal mercato":    ("RETAIL", "Display & Allestimento"),
    # ── COMMERCIAL ──
    "Ordine non arrivato":              ("COMMERCIAL", "Disservizi corriere"),
    "Errore nel listino prezzi":        ("COMMERCIAL", "Prezzi stampa etichette"),
    "Richiesta campioni nuova collezione": ("COMMERCIAL", "Promozioni"),
    "Promozione non attiva in cassa":   ("COMMERCIAL", "Promozioni"),
    "Fornitore non consegna":           ("COMMERCIAL", "Disservizi corriere"),
    "Richiesta cambio prezzi":          ("COMMERCIAL", "Prezzi stampa etichette"),
    # ── MARKETING ──
    "Materiale POP non arrivato":       ("MARKETING", "Materiali Promozionali"),
    "Errore su volantino":              ("MARKETING", "Materiali Promozionali"),
    "Richiesta foto negozio":           ("MARKETING", "Comunicazioni Negozio"),
    "Problema insegna esterna":         ("FACILITIES", "Manutenzione Negozio"),
    "Evento in negozio":                ("MARKETING", "Comunicazioni Negozio"),
    "Social media - commento negativo": ("MARKETING", "Comunicazioni Negozio"),
    # ── FACILITIES ──
    "Luci reparto rotte":               ("FACILITIES", "Climatizzazione & Illuminazione"),
    "Bagno clienti guasto":             ("FACILITIES", "Manutenzione Negozio"),
    "Problema climatizzazione":         ("FACILITIES", "Climatizzazione & Illuminazione"),
    "Serratura porta magazzino":        ("FACILITIES", "Manutenzione Negozio"),
    "Allarme antifurto difettoso":      ("FACILITIES", "Manutenzione Negozio"),
    "Infiltrazione acqua":              ("FACILITIES", "Manutenzione Negozio"),
    "Pulizia straordinaria":            ("FACILITIES", "Pulizie & Forniture"),
    "Porta automatica bloccata":        ("FACILITIES", "Manutenzione Negozio"),
    "Ascensore fuori servizio":         ("FACILITIES", "Manutenzione Negozio"),
    # ── FINANCE ──
    "Differenza di cassa":              ("FINANCE", "Cassa & Riconciliazione"),
    "Richiesta nota spese":             ("FINANCE", "Note Spese & Rimborsi"),
    "Fattura fornitore errata":         ("FINANCE", "Fatturazione & Fornitori"),
    "Problema con il fondo cassa":      ("FINANCE", "Cassa & Riconciliazione"),
    "Rimborso cliente":                 ("FINANCE", "Note Spese & Rimborsi"),
    "Richiesta budget per evento":      ("FINANCE", "Budget & Previsioni"),
}

# Mappa risolta al setup: titolo → (cat_id, sub_id)
resolved_category_map: dict[str, tuple[int, int | None]] = {}

COMMENT_TEXTS = [
    "Ho verificato il problema. Procedo con la diagnostica.",
    "Potrebbe essere un problema di driver. Provo ad aggiornare.",
    "Puoi provare a riavviare il dispositivo e farmi sapere?",
    "Ho effettuato un controllo remoto. Il problema è stato identificato.",
    "Sto ordinando il pezzo di ricambio. Arriverà in 2-3 giorni lavorativi.",
    "Il problema è stato risolto aggiornando il firmware alla versione più recente.",
    "Ho contattato il fornitore per avere supporto tecnico specifico.",
    "Confermo che il problema è noto. È in corso un fix dal team sviluppo.",
    "Ho reimpostato le credenziali. Prova ad accedere con la nuova password.",
    "Il problema era dovuto a un conflitto con un altro software. Rimosso.",
    "Servono maggiori informazioni. Puoi inviarmi uno screenshot dell'errore?",
    "Ho verificato i log del sistema. L'errore è causato da un timeout di rete.",
    "La sostituzione è stata programmata per domani mattina.",
    "Ho applicato la patch correttiva. Monitoro per le prossime 24 ore.",
    "Il ticket verrà escalato al team di secondo livello per ulteriori analisi.",
    "Intervento completato. Il dispositivo è tornato operativo.",
    "Ho configurato il backup automatico per evitare che il problema si ripeta.",
    "Il problema è legato alla VPN. Ho riconfigurato il profilo di connessione.",
]

REQUESTER_NAMES = [
    "Marco Rossi", "Laura Bianchi", "Giuseppe Verdi", "Anna Colombo",
    "Luca Ferrari", "Francesca Romano", "Alessandro Russo", "Chiara Ricci",
    "Matteo Marino", "Sara Greco", "Davide Conti", "Elena Fontana",
    "Simone Lombardi", "Valentina Moretti", "Andrea Barbieri",
]

PHONE_NUMBERS = [
    "3331234567", "3287654321", "3401112233", "3519876543",
    "3662345678", "3773456789", "3384567890", "3295678901",
]


# ═══════════════════════════════════════════════════════════════════
# METRICHE
# ═══════════════════════════════════════════════════════════════════

class Metrics:
    def __init__(self):
        self.response_times = defaultdict(list)  # endpoint -> [ms, ...]
        self.errors = []  # [{ scenario, endpoint, status, detail, ts }]
        self.scenario_times = {}  # scenario_name -> (start, end)
        self.scenario_counts = {}  # scenario_name -> { success, fail }

    def record(self, endpoint: str, elapsed_ms: float):
        self.response_times[endpoint].append(elapsed_ms)

    def record_error(self, scenario: str, endpoint: str, status: int, detail: str):
        self.errors.append({
            "scenario": scenario,
            "endpoint": endpoint,
            "status": status,
            "detail": detail[:200],
            "ts": datetime.now().strftime("%H:%M:%S"),
        })

    def stats_for(self, endpoint: str) -> dict:
        times = self.response_times.get(endpoint, [])
        if not times:
            return {"count": 0}
        sorted_t = sorted(times)
        n = len(sorted_t)
        return {
            "count": n,
            "min": round(sorted_t[0], 1),
            "max": round(sorted_t[-1], 1),
            "avg": round(statistics.mean(sorted_t), 1),
            "median": round(statistics.median(sorted_t), 1),
            "p95": round(sorted_t[int(n * 0.95)] if n > 1 else sorted_t[0], 1),
            "p99": round(sorted_t[int(n * 0.99)] if n > 1 else sorted_t[0], 1),
        }


metrics = Metrics()

# Utenti divisi per livello di permesso (popolati in setup)
creators = []   # utenti con permesso tickets (possono creare)
managers = []   # utenti con permesso tickets.manage (possono commentare/cambiare stato)


# ═══════════════════════════════════════════════════════════════════
# GENERAZIONE ALLEGATO PDF 1 MB
# ═══════════════════════════════════════════════════════════════════

def generate_pdf_bytes(size: int = SA_ATTACHMENT_SIZE) -> bytes:
    """Genera un PDF minimale valido, padded alla dimensione target."""
    core = b"""%PDF-1.0
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]>>endobj
"""
    trailer = b"""xref
0 4
0000000000 65535 f \r\n0000000009 00000 n \r\n0000000052 00000 n \r\n0000000101 00000 n \r\ntrailer<</Size 4/Root 1 0 R>>
startxref
178
%%EOF"""
    padding_size = size - len(core) - len(trailer) - 10
    if padding_size > 0:
        # PDF comment lines (ignored by readers)
        padding = b"\n%" + (b"X" * (padding_size - 2)) + b"\n"
    else:
        padding = b""
    return core + padding + trailer


# Pre-genera il file una volta sola (riusato per tutti gli upload)
PDF_ATTACHMENT = generate_pdf_bytes()


# ═══════════════════════════════════════════════════════════════════
# CLIENT API
# ═══════════════════════════════════════════════════════════════════

class ApiClient:
    """Wrapper async per le API FTC HUB con tracking metriche."""

    def __init__(self, client: httpx.AsyncClient, token: str, username: str, full_name: str = ""):
        self.client = client
        self.token = token
        self.username = username
        self.full_name = full_name or username
        self.headers = {"Authorization": f"Bearer {token}"}

    async def _request(self, method: str, path: str, endpoint_name: str,
                       scenario: str, **kwargs) -> httpx.Response | None:
        url = f"{BASE_URL}{path}"
        kwargs.setdefault("headers", {}).update(self.headers)
        kwargs.setdefault("timeout", HTTP_TIMEOUT)
        t0 = time.perf_counter()
        try:
            resp = await self.client.request(method, url, **kwargs)
            elapsed = (time.perf_counter() - t0) * 1000
            metrics.record(endpoint_name, elapsed)
            if resp.status_code >= 400:
                detail = resp.text[:200] if resp.text else str(resp.status_code)
                metrics.record_error(scenario, endpoint_name, resp.status_code, detail)
                return None
            return resp
        except Exception as e:
            elapsed = (time.perf_counter() - t0) * 1000
            metrics.record(endpoint_name, elapsed)
            metrics.record_error(scenario, endpoint_name, 0, str(e)[:200])
            return None

    async def create_ticket(self, scenario: str, category_id: int = None,
                            subcategory_id: int | None = None,
                            priority: str = "medium",
                            title: str = None,
                            description: str = None) -> dict | None:
        # Se titolo non fornito, scegli scenario random
        if not title:
            idx = random.randrange(len(TICKET_SCENARIOS))
            title = TICKET_SCENARIOS[idx][0]
            description = TICKET_SCENARIOS[idx][1]

        # Risolvi categoria dalla mappa se non fornita esplicitamente
        if category_id is None and title in resolved_category_map:
            category_id, subcategory_id = resolved_category_map[title]
        elif category_id is None:
            category_id, subcategory_id = random_category()

        payload = {
            "title": title,
            "description": description,
            "category_id": category_id,
            "subcategory_id": subcategory_id,
            "priority": priority,
            "requester_name": self.full_name,
            "requester_email": f"test_{random.randint(1000,9999)}@tigeritalia.com",
            "requester_phone": random.choice(PHONE_NUMBERS),
            "teamviewer_code": f"TV-{random.randint(100000000, 999999999)}",
        }
        resp = await self._request(
            "POST", "/api/tickets", "POST /api/tickets", scenario,
            json=payload,
        )
        if resp:
            return resp.json()
        return None

    async def add_comment(self, scenario: str, ticket_id: str,
                          is_internal: bool = False) -> dict | None:
        payload = {
            "content": random.choice(COMMENT_TEXTS),
            "is_internal": is_internal,
        }
        resp = await self._request(
            "POST", f"/api/tickets/{ticket_id}/comments",
            "POST /api/tickets/comments", scenario,
            json=payload,
        )
        if resp:
            return resp.json()
        return None

    async def upload_attachment(self, scenario: str, ticket_id: str,
                                comment_id: str | None = None) -> dict | None:
        filename = f"allegato_{random.randint(1000,9999)}.pdf"
        files = {"file": (filename, PDF_ATTACHMENT, "application/pdf")}
        params = {}
        if comment_id:
            params["comment_id"] = comment_id
        resp = await self._request(
            "POST", f"/api/tickets/{ticket_id}/attachments",
            "POST /api/tickets/attachments", scenario,
            files=files, params=params,
        )
        if resp:
            return resp.json()
        return None

    async def update_status(self, scenario: str, ticket_id: str,
                            status: str) -> dict | None:
        resp = await self._request(
            "PUT", f"/api/tickets/{ticket_id}/status",
            "PUT /api/tickets/status", scenario,
            json={"status": status},
        )
        if resp:
            return resp.json()
        return None

    async def list_tickets(self, scenario: str, **params) -> list | None:
        resp = await self._request(
            "GET", "/api/tickets", "GET /api/tickets", scenario,
            params=params,
        )
        if resp:
            return resp.json()
        return None

    async def get_stats(self, scenario: str) -> dict | None:
        resp = await self._request(
            "GET", "/api/tickets/stats", "GET /api/tickets/stats", scenario,
        )
        if resp:
            return resp.json()
        return None

    async def analyze_ticket(self, scenario: str, title: str,
                              description: str) -> dict | None:
        """Chiama l'AI per analizzare il ticket e ottenere routing corretto."""
        resp = await self._request(
            "POST", "/api/tickets/chat/analyze",
            "POST /api/tickets/chat/analyze", scenario,
            json={"title": title, "description": description},
            timeout=30.0,  # AI può essere lenta
        )
        if resp:
            return resp.json()
        return None

    async def assign_ticket(self, scenario: str, ticket_id: str,
                            user_id: str) -> dict | None:
        resp = await self._request(
            "PUT", f"/api/tickets/{ticket_id}/assign",
            "PUT /api/tickets/assign", scenario,
            json={"assigned_to": user_id},
        )
        if resp:
            return resp.json()
        return None


# ═══════════════════════════════════════════════════════════════════
# SETUP — login utenti, fetch categorie
# ═══════════════════════════════════════════════════════════════════

async def login_user(client: httpx.AsyncClient, username: str) -> dict | None:
    """Login e ritorna { user_id, username, token, role, department } oppure None."""
    try:
        resp = await client.post(
            f"{BASE_URL}/api/auth/login",
            json={"username": username, "password": PASSWORD},
            timeout=15.0,
        )
        if resp.status_code == 200:
            data = resp.json()
            return {
                "user_id": data["user"]["id"],
                "username": data["user"]["username"],
                "full_name": data["user"].get("full_name", username),
                "token": data["access_token"],
                "role": data["user"].get("role", ""),
                "department": data["user"].get("department", ""),
            }
    except Exception:
        pass
    return None


async def check_ticket_permission(client: httpx.AsyncClient, token: str) -> tuple[bool, bool]:
    """Verifica se l'utente può creare ticket (can_view) e gestirli (can_manage).
    Ritorna (can_create, can_manage)."""
    headers = {"Authorization": f"Bearer {token}"}
    can_create = False
    can_manage = False
    try:
        # Test: lista ticket (richiede permesso tickets base)
        resp = await client.get(f"{BASE_URL}/api/tickets",
                                headers=headers, timeout=10.0)
        can_create = resp.status_code == 200

        # Test: stats (richiede tickets.manage)
        resp2 = await client.get(f"{BASE_URL}/api/tickets/stats",
                                 headers=headers, timeout=10.0)
        can_manage = resp2.status_code == 200
    except Exception:
        pass
    return can_create, can_manage


async def setup(client: httpx.AsyncClient):
    """
    1. Recupera lista utenti (login con admin)
    2. Login con tutti gli utenti
    3. Recupera categorie e subcategorie
    """
    global user_tokens, categories, subcategories, teams
    user_tokens = []
    categories = []
    subcategories = {}
    teams = []

    print("\n" + "=" * 60)
    print("  SETUP — Preparazione ambiente di test")
    print("=" * 60)

    # Login con il primo utente disponibile per recuperare dati
    # Proviamo con utenti comuni
    test_users = ["admin", "superuser", "fmelo", "Admin", "ADMIN", "Bruno Danaro"]
    admin_token = None
    for u in test_users:
        result = await login_user(client, u)
        if result:
            admin_token = result
            print(f"  [OK] Login admin: {u}")
            break

    if not admin_token:
        print("  [ERRORE] Impossibile fare login con utenti admin noti.")
        print("           Inserisci un username valido: ", end="")
        u = input().strip()
        admin_token = await login_user(client, u)
        if not admin_token:
            print("  [ERRORE] Login fallito. Uscita.")
            sys.exit(1)

    headers = {"Authorization": f"Bearer {admin_token['token']}"}

    # Recupera lista utenti
    print("  [..] Recupero lista utenti...")
    try:
        resp = await client.get(f"{BASE_URL}/api/tickets/users",
                                headers=headers, timeout=15.0)
        if resp.status_code == 200:
            data = resp.json()
            user_list = data.get("users", data) if isinstance(data, dict) else data
        else:
            print(f"  [WARN] GET /api/tickets/users → {resp.status_code}")
            user_list = []
    except Exception as e:
        print(f"  [WARN] Errore recupero utenti: {e}")
        user_list = []

    # Login con tutti gli utenti
    print(f"  [..] Login con {len(user_list)} utenti (password: {PASSWORD})...")
    logged_in = 0
    # Login in batch da 20 per non sovraccaricare
    batch_size = 20
    usernames = [u.get("username", u.get("full_name", "")) for u in user_list if u.get("username", u.get("full_name", ""))]
    for i in range(0, len(usernames), batch_size):
        batch = usernames[i:i + batch_size]
        results = await asyncio.gather(*[login_user(client, uname) for uname in batch])
        for result in results:
            if result:
                user_tokens.append(result)
                logged_in += 1
        if (i + batch_size) % 100 == 0 or i + batch_size >= len(usernames):
            print(f"    {min(i + batch_size, len(usernames))}/{len(usernames)} — {logged_in} OK")

    # Aggiungi l'admin se non è già nella lista
    if not any(t["user_id"] == admin_token["user_id"] for t in user_tokens):
        user_tokens.append(admin_token)

    print(f"  [OK] {len(user_tokens)} utenti autenticati")

    if len(user_tokens) == 0:
        print("  [ERRORE] Nessun utente autenticato. Uscita.")
        sys.exit(1)

    # Recupera categorie
    print("  [..] Recupero categorie...")
    try:
        resp = await client.get(f"{BASE_URL}/api/tickets/categories",
                                headers=headers, timeout=15.0)
        if resp.status_code == 200:
            categories = resp.json()
            print(f"  [OK] {len(categories)} categorie trovate")
        else:
            print(f"  [WARN] GET /api/tickets/categories → {resp.status_code}")
    except Exception as e:
        print(f"  [WARN] Errore recupero categorie: {e}")

    # Recupera subcategorie per ogni categoria
    for cat in categories:
        cat_id = cat.get("id")
        if not cat_id:
            continue
        try:
            resp = await client.get(
                f"{BASE_URL}/api/tickets/categories/{cat_id}/subcategories",
                headers=headers, timeout=15.0)
            if resp.status_code == 200:
                subs = resp.json()
                if subs:
                    subcategories[cat_id] = subs
        except Exception:
            pass

    total_subs = sum(len(v) for v in subcategories.values())
    print(f"  [OK] {total_subs} subcategorie trovate")

    # Risolvi SCENARIO_CATEGORY_MAP: nomi → ID
    cat_name_to_id = {c["name"]: c["id"] for c in categories}
    sub_name_to_id: dict[int, dict[str, int]] = {}
    for cid, subs_list in subcategories.items():
        sub_name_to_id[cid] = {s["name"]: s["id"] for s in subs_list}

    mapped = 0
    for title, (cat_name, sub_name) in SCENARIO_CATEGORY_MAP.items():
        cid = cat_name_to_id.get(cat_name)
        if not cid:
            continue
        sid = sub_name_to_id.get(cid, {}).get(sub_name)
        resolved_category_map[title] = (cid, sid)
        mapped += 1
    print(f"  [OK] {mapped}/{len(SCENARIO_CATEGORY_MAP)} scenari mappati a categoria/subcategoria")

    # Fallback: se non ci sono categorie, creiamo dati minimi
    if not categories:
        print("  [WARN] Nessuna categoria trovata. I ticket verranno creati senza categoria.")

    # Classifica utenti per livello di permesso
    global creators, managers
    creators = []
    managers = []
    print(f"  [..] Verifica permessi utenti (campione)...")
    # Testa un campione per velocizzare (max 60 utenti)
    sample = user_tokens[:60] if len(user_tokens) > 60 else user_tokens
    check_tasks = [(u, check_ticket_permission(client, u["token"])) for u in sample]
    for u, task in check_tasks:
        can_create, can_manage = await task
        if can_manage:
            managers.append(u)
            creators.append(u)
        elif can_create:
            creators.append(u)

    # Se abbiamo più utenti non testati, assumiamo che siano creators
    if len(user_tokens) > len(sample):
        for u in user_tokens[len(sample):]:
            creators.append(u)

    print(f"  [OK] {len(creators)} creators, {len(managers)} managers")

    if not managers:
        print("  [WARN] Nessun utente con tickets.manage trovato!")
        print("         Commenti e cambi stato saranno limitati ai creators.")
        managers = creators[:5]  # fallback

    print(f"\n  Riepilogo setup:")
    print(f"    Utenti autenticati: {len(user_tokens)}")
    print(f"    Creators (tickets): {len(creators)}")
    print(f"    Managers (manage):  {len(managers)}")
    print(f"    Categorie:          {len(categories)}")
    print(f"    Subcategorie:       {total_subs}")
    print(f"    Dimensione allegato: {SA_ATTACHMENT_SIZE // 1024} KB")
    print()


def random_category() -> tuple[int | None, int | None]:
    """Ritorna (category_id, subcategory_id) random."""
    if not categories:
        return None, None
    cat = random.choice(categories)
    cat_id = cat.get("id")
    sub_id = None
    if cat_id in subcategories and subcategories[cat_id]:
        sub = random.choice(subcategories[cat_id])
        sub_id = sub.get("id")
    return cat_id, sub_id


def random_priority() -> str:
    return random.choices(
        ["low", "medium", "high", "critical"],
        weights=[20, 50, 25, 5],
    )[0]


def get_random_creator(http_client: httpx.AsyncClient) -> ApiClient:
    """Ritorna un ApiClient con un utente che può creare ticket."""
    u = random.choice(creators)
    return ApiClient(http_client, u["token"], u["username"], u.get("full_name", ""))


def get_random_manager(http_client: httpx.AsyncClient) -> ApiClient:
    """Ritorna un ApiClient con un utente che può gestire ticket (commenti, status)."""
    u = random.choice(managers)
    return ApiClient(http_client, u["token"], u["username"], u.get("full_name", ""))


# ═══════════════════════════════════════════════════════════════════
# SCENARIO A — Sustained Load: 2000 ticket in 1 ora
# ═══════════════════════════════════════════════════════════════════

async def create_full_ticket(sem: asyncio.Semaphore, http_client: httpx.AsyncClient,
                              ticket_num: int, scenario: str):
    """Crea 1 ticket con analisi AI + commenti + allegati."""
    async with sem:
        api = get_random_creator(http_client)

        # 1. Scegli scenario random
        title, description = random.choice(TICKET_SCENARIOS)
        store = f"IT{random.randint(100, 350)}"
        description = f"[Negozio {store}] {description}"

        # 2. Analisi AI (come nel flusso reale)
        analysis = await api.analyze_ticket(scenario, title, description)

        if analysis and analysis.get("relevant", True):
            category_id = analysis.get("category_id")
            subcategory_id = analysis.get("subcategory_id")
            priority = analysis.get("priority", "medium")
            enhanced_desc = analysis.get("enhanced_description") or description
            team_id = None
            suggested = analysis.get("suggested_teams") or []
            if suggested:
                team_id = suggested[0].get("id") or suggested[0].get("team_id")
        else:
            # Fallback: mappa statica
            if title in resolved_category_map:
                category_id, subcategory_id = resolved_category_map[title]
            else:
                category_id, subcategory_id = random_category()
            priority = random_priority()
            enhanced_desc = description
            team_id = None

        if priority not in ("low", "medium", "high", "critical"):
            priority = "medium"

        # 3. Crea ticket con dati AI
        payload = {
            "title": title,
            "description": enhanced_desc,
            "original_description": description,
            "category_id": category_id,
            "subcategory_id": subcategory_id,
            "priority": priority,
            "requester_name": api.full_name,
            "requester_email": f"store_{store.lower()}@tigeritalia.com",
            "requester_phone": random.choice(PHONE_NUMBERS),
            "teamviewer_code": f"TV-{random.randint(100000000, 999999999)}",
        }
        if team_id:
            payload["team_id"] = team_id

        resp = await api._request(
            "POST", "/api/tickets", "POST /api/tickets", scenario,
            json=payload,
        )
        if not resp:
            return
        ticket = resp.json()

        ticket_id = ticket.get("id")
        if not ticket_id:
            return

        # 4. Aggiungi commenti (usa manager per avere permesso)
        n_comments = random.randint(*SA_COMMENTS_RANGE)
        n_attachments = random.randint(*SA_ATTACHMENTS_RANGE)

        for i in range(n_comments):
            comment_api = get_random_manager(http_client)
            await comment_api.add_comment(
                scenario, ticket_id,
                is_internal=random.random() < 0.2,
            )

        # 5. Upload allegati (usa il creatore o manager)
        for i in range(n_attachments):
            attach_api = get_random_manager(http_client)
            await attach_api.upload_attachment(scenario, ticket_id)


async def scenario_a(http_client: httpx.AsyncClient):
    """2000 ticket distribuiti in 1 ora."""
    scenario = "A"
    print("\n" + "=" * 60)
    print("  SCENARIO A — Sustained Load")
    print(f"  {SA_TOTAL_TICKETS} ticket in {SA_DURATION_SEC}s")
    print(f"  (~{SA_TOTAL_TICKETS / (SA_DURATION_SEC / 60):.1f} ticket/min)")
    print("=" * 60)

    # Concurrency ridotta: ogni ticket passa dall'AI (più lento)
    ai_concurrency = min(MAX_CONCURRENT_REQUESTS, 10)
    sem = asyncio.Semaphore(ai_concurrency)
    use_rate_limit = SA_TOTAL_TICKETS > 400
    interval = SA_DURATION_SEC / SA_TOTAL_TICKETS if use_rate_limit else 0
    t_start = time.perf_counter()
    metrics.scenario_times["A"] = (datetime.now(), None)

    print(f"  (AI routing attivo — concurrency: {ai_concurrency})")
    if not use_rate_limit:
        print(f"  (max velocità — rate limiting solo sopra 400 ticket)")

    tasks = []
    for i in range(SA_TOTAL_TICKETS):
        task = asyncio.create_task(
            create_full_ticket(sem, http_client, i + 1, scenario)
        )
        tasks.append(task)

        if use_rate_limit and i < SA_TOTAL_TICKETS - 1:
            elapsed = time.perf_counter() - t_start
            expected = (i + 1) * interval
            wait = expected - elapsed
            if wait > 0:
                await asyncio.sleep(wait)

        progress_step = max(10, SA_TOTAL_TICKETS // 10)
        if (i + 1) % progress_step == 0:
            elapsed_min = (time.perf_counter() - t_start) / 60
            err_count = len([e for e in metrics.errors if e["scenario"] == scenario])
            print(f"  [{i + 1:>4}/{SA_TOTAL_TICKETS}] "
                  f"{elapsed_min:.1f} min — errori: {err_count}")

    # Attendi che tutti i task finiscano
    await asyncio.gather(*tasks, return_exceptions=True)

    t_end = time.perf_counter()
    duration = t_end - t_start
    metrics.scenario_times["A"] = (metrics.scenario_times["A"][0], datetime.now())

    err_count = len([e for e in metrics.errors if e["scenario"] == scenario])
    print(f"\n  Scenario A completato in {duration:.1f}s ({duration / 60:.1f} min)")
    print(f"  Errori: {err_count}")


# ═══════════════════════════════════════════════════════════════════
# SCENARIO B — Spike: 200 ticket simultanei
# ═══════════════════════════════════════════════════════════════════

async def create_simple_ticket(http_client: httpx.AsyncClient, scenario: str):
    """Crea 1 ticket (senza commenti/allegati) per test spike."""
    api = get_random_creator(http_client)
    return await api.create_ticket(scenario, priority=random_priority())


async def scenario_b(http_client: httpx.AsyncClient):
    """200 ticket creati tutti simultaneamente."""
    scenario = "B"
    print("\n" + "=" * 60)
    print("  SCENARIO B — Spike")
    print(f"  {SB_SIMULTANEOUS} ticket simultanei")
    print("=" * 60)

    metrics.scenario_times["B"] = (datetime.now(), None)
    t_start = time.perf_counter()

    tasks = [
        create_simple_ticket(http_client, scenario)
        for _ in range(SB_SIMULTANEOUS)
    ]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    t_end = time.perf_counter()
    duration = t_end - t_start
    metrics.scenario_times["B"] = (metrics.scenario_times["B"][0], datetime.now())

    success = sum(1 for r in results if r is not None and not isinstance(r, Exception))
    fail = SB_SIMULTANEOUS - success
    err_count = len([e for e in metrics.errors if e["scenario"] == scenario])

    print(f"\n  Scenario B completato in {duration:.1f}s")
    print(f"  Successi: {success} | Falliti: {fail} | Errori totali: {err_count}")


# ═══════════════════════════════════════════════════════════════════
# SCENARIO C — Mixed Workload: 50 utenti simultanei
# ═══════════════════════════════════════════════════════════════════

async def mixed_user_session(http_client: httpx.AsyncClient, user_info: dict,
                              is_manager: bool,
                              created_ticket_ids: list, tickets_created_count: list,
                              lock: asyncio.Lock,
                              stop_event: asyncio.Event, scenario: str):
    """
    Simula un utente che fa operazioni miste.
    Manager: 30% crea, 25% cambia stato, 25% commenta, 10% assegna, 10% lista
    Creator: 50% crea, 10% lista, 40% pausa (non può fare altro)
    """
    api = ApiClient(http_client, user_info["token"], user_info["username"], user_info.get("full_name", ""))
    ops_done = 0

    while not stop_event.is_set():
        roll = random.random()

        try:
            if is_manager:
                if roll < 0.3:
                    # Crea ticket
                    cat_id, sub_id = random_category()
                    ticket = await api.create_ticket(scenario, cat_id, sub_id, random_priority())
                    if ticket and ticket.get("id"):
                        async with lock:
                            created_ticket_ids.append(ticket["id"])
                        tickets_created_count[0] += 1

                elif roll < 0.55:
                    # Cambia stato
                    async with lock:
                        tid = random.choice(created_ticket_ids) if created_ticket_ids else None
                    if tid:
                        new_status = random.choice(["in_progress", "waiting", "closed"])
                        await api.update_status(scenario, tid, new_status)

                elif roll < 0.8:
                    # Aggiungi commento
                    async with lock:
                        tid = random.choice(created_ticket_ids) if created_ticket_ids else None
                    if tid:
                        await api.add_comment(scenario, tid)

                elif roll < 0.9:
                    # Assegna ticket
                    async with lock:
                        tid = random.choice(created_ticket_ids) if created_ticket_ids else None
                    if tid:
                        target = random.choice(managers)
                        await api.assign_ticket(scenario, tid, target["user_id"])

                else:
                    # Lista ticket
                    await api.list_tickets(scenario, status="open")

            else:
                # Creator: può solo creare e leggere
                if roll < 0.6:
                    cat_id, sub_id = random_category()
                    ticket = await api.create_ticket(scenario, cat_id, sub_id, random_priority())
                    if ticket and ticket.get("id"):
                        async with lock:
                            created_ticket_ids.append(ticket["id"])
                        tickets_created_count[0] += 1
                else:
                    await api.list_tickets(scenario, status="open")

        except Exception:
            pass

        ops_done += 1
        # Piccola pausa per simulare utente reale (100-500ms)
        await asyncio.sleep(random.uniform(0.1, 0.5))

    return ops_done


async def scenario_c(http_client: httpx.AsyncClient):
    """50 utenti simultanei con operazioni miste per 5 minuti."""
    scenario = "C"
    n_users = min(SC_CONCURRENT_USERS, len(user_tokens))

    print("\n" + "=" * 60)
    print("  SCENARIO C — Mixed Workload")
    print(f"  {n_users} utenti simultanei per {SC_DURATION_SEC}s")
    print("=" * 60)

    if n_users < SC_CONCURRENT_USERS:
        print(f"  [WARN] Solo {n_users} utenti disponibili "
              f"(richiesti {SC_CONCURRENT_USERS})")

    metrics.scenario_times["C"] = (datetime.now(), None)
    t_start = time.perf_counter()

    created_ticket_ids = []
    tickets_created_count = [0]  # lista per poterlo mutare nelle coroutine
    lock = asyncio.Lock()
    stop_event = asyncio.Event()

    # Pre-popola con qualche ticket ID dalla lista esistente
    first_api = ApiClient(http_client, user_tokens[0]["token"], user_tokens[0]["username"], user_tokens[0].get("full_name", ""))
    existing = await first_api.list_tickets(scenario, status="open")
    if existing and isinstance(existing, list):
        created_ticket_ids.extend([t["id"] for t in existing[:20] if "id" in t])

    # Seleziona utenti: mix di managers e creators
    # Priorità ai managers, poi riempiamo con creators
    manager_set = set(u["user_id"] for u in managers)
    selected_users = []
    selected_is_manager = []
    # Prima tutti i manager disponibili
    for u in managers[:n_users]:
        selected_users.append(u)
        selected_is_manager.append(True)
    # Poi riempiamo con creators
    remaining = n_users - len(selected_users)
    for u in creators:
        if remaining <= 0:
            break
        if u["user_id"] not in manager_set:
            selected_users.append(u)
            selected_is_manager.append(False)
            remaining -= 1
    # Se ancora non bastano, cicla
    while len(selected_users) < n_users:
        idx = len(selected_users) % len(user_tokens)
        selected_users.append(user_tokens[idx])
        selected_is_manager.append(user_tokens[idx]["user_id"] in manager_set)

    n_mgr = sum(selected_is_manager)
    print(f"  Utenti selezionati: {n_mgr} managers + {n_users - n_mgr} creators")

    # Avvia sessioni utente
    tasks = [
        mixed_user_session(http_client, u, is_mgr, created_ticket_ids, tickets_created_count, lock, stop_event, scenario)
        for u, is_mgr in zip(selected_users, selected_is_manager)
    ]

    # Timer per fermare dopo SC_DURATION_SEC
    async def stop_after():
        await asyncio.sleep(SC_DURATION_SEC)
        stop_event.set()
        print(f"  [STOP] Tempo scaduto ({SC_DURATION_SEC}s)")

    stop_task = asyncio.create_task(stop_after())

    # Progress
    async def progress_reporter():
        while not stop_event.is_set():
            await asyncio.sleep(30)
            if not stop_event.is_set():
                elapsed = time.perf_counter() - t_start
                err_count = len([e for e in metrics.errors if e["scenario"] == scenario])
                print(f"  [{elapsed:.0f}s] ticket creati: {tickets_created_count[0]} — errori: {err_count}")

    progress_task = asyncio.create_task(progress_reporter())

    results = await asyncio.gather(*tasks, return_exceptions=True)

    stop_task.cancel()
    progress_task.cancel()

    t_end = time.perf_counter()
    duration = t_end - t_start
    metrics.scenario_times["C"] = (metrics.scenario_times["C"][0], datetime.now())

    total_ops = sum(r for r in results if isinstance(r, int))
    err_count = len([e for e in metrics.errors if e["scenario"] == scenario])

    print(f"\n  Scenario C completato in {duration:.1f}s")
    print(f"  Operazioni totali: {total_ops} | Ticket creati: {tickets_created_count[0]} | Errori: {err_count}")
    print(f"  Throughput: {total_ops / duration:.1f} ops/sec")


# ═══════════════════════════════════════════════════════════════════
# SCENARIO D — AI Routing: 400 ticket analizzati dall'AI
# ═══════════════════════════════════════════════════════════════════

async def ai_create_ticket(sem: asyncio.Semaphore, http_client: httpx.AsyncClient,
                            ticket_num: int, scenario: str):
    """Analizza con AI e crea ticket con routing corretto."""
    async with sem:
        api = get_random_creator(http_client)

        # 1. Scegli un scenario random
        title, description = random.choice(TICKET_SCENARIOS)
        # Aggiungi variazione per evitare duplicati identici
        store = f"IT{random.randint(100, 350)}"
        description = f"[Negozio {store}] {description}"

        # 2. Chiama l'AI per analizzare
        analysis = await api.analyze_ticket(scenario, title, description)
        if not analysis:
            return None

        # 3. Estrai suggerimenti dell'AI
        category_id = analysis.get("category_id")
        subcategory_id = analysis.get("subcategory_id")
        priority = analysis.get("priority", "medium")
        enhanced_desc = analysis.get("enhanced_description") or description

        # Valida priority
        if priority not in ("low", "medium", "high", "critical"):
            priority = "medium"

        # 4. Crea il ticket con i dati AI
        payload = {
            "title": title,
            "description": enhanced_desc,
            "original_description": description,
            "category_id": category_id,
            "subcategory_id": subcategory_id,
            "priority": priority,
            "requester_name": api.full_name,
            "requester_email": f"store_{store.lower()}@tigeritalia.com",
            "requester_phone": random.choice(PHONE_NUMBERS),
            "teamviewer_code": f"TV-{random.randint(100000000, 999999999)}",
        }
        resp = await api._request(
            "POST", "/api/tickets", "POST /api/tickets", scenario,
            json=payload,
        )
        if resp:
            return resp.json()
        return None


async def scenario_d(http_client: httpx.AsyncClient):
    """400 ticket analizzati dall'AI per routing corretto."""
    scenario = "D"
    print("\n" + "=" * 60)
    print("  SCENARIO D — AI Routing")
    print(f"  {SD_TOTAL_TICKETS} ticket con analisi AI (concurrency: {SD_CONCURRENCY})")
    print(f"  Costo stimato: ~${SD_TOTAL_TICKETS * 0.0025:.2f}")
    print("=" * 60)

    sem = asyncio.Semaphore(SD_CONCURRENCY)
    metrics.scenario_times["D"] = (datetime.now(), None)
    t_start = time.perf_counter()

    tasks = []
    for i in range(SD_TOTAL_TICKETS):
        task = asyncio.create_task(
            ai_create_ticket(sem, http_client, i + 1, scenario)
        )
        tasks.append(task)

        # Progress ogni 50 ticket
        if (i + 1) % 50 == 0:
            # Aspetta i task in corso prima di stampare
            done_so_far = sum(1 for t in tasks if t.done())
            elapsed = time.perf_counter() - t_start
            err_count = len([e for e in metrics.errors if e["scenario"] == scenario])
            print(f"  [{i + 1:>3}/{SD_TOTAL_TICKETS}] "
                  f"{elapsed:.0f}s — completati: {done_so_far} — errori: {err_count}")

    results = await asyncio.gather(*tasks, return_exceptions=True)

    t_end = time.perf_counter()
    duration = t_end - t_start
    metrics.scenario_times["D"] = (metrics.scenario_times["D"][0], datetime.now())

    success = sum(1 for r in results if r is not None and not isinstance(r, Exception))
    err_count = len([e for e in metrics.errors if e["scenario"] == scenario])

    # Statistiche AI
    analyze_times = metrics.response_times.get("POST /api/tickets/chat/analyze", [])
    avg_ai = round(statistics.mean(analyze_times), 0) if analyze_times else 0

    print(f"\n  Scenario D completato in {duration:.1f}s ({duration / 60:.1f} min)")
    print(f"  Ticket creati: {success}/{SD_TOTAL_TICKETS}")
    print(f"  Errori: {err_count}")
    print(f"  Latenza media AI: {avg_ai}ms ({avg_ai / 1000:.1f}s)")
    print(f"  Throughput: {success / duration:.2f} ticket/sec")


# ═══════════════════════════════════════════════════════════════════
# REPORT HTML
# ═══════════════════════════════════════════════════════════════════

def generate_report():
    """Genera il report HTML con i risultati dello stress test."""
    now = datetime.now().strftime("%d/%m/%Y %H:%M")

    # Calcola statistiche per ogni endpoint
    endpoints = sorted(metrics.response_times.keys())
    endpoint_rows = ""
    for ep in endpoints:
        s = metrics.stats_for(ep)
        if s["count"] == 0:
            continue
        err_count = len([e for e in metrics.errors if e["endpoint"] == ep])
        err_pct = (err_count / s["count"] * 100) if s["count"] > 0 else 0
        color = "#dc2626" if err_pct > 5 else "#f59e0b" if err_pct > 1 else "#16a34a"
        endpoint_rows += f"""
        <tr>
          <td style="font-weight:600">{ep}</td>
          <td style="text-align:right">{s['count']:,}</td>
          <td style="text-align:right">{s['min']}</td>
          <td style="text-align:right">{s['avg']}</td>
          <td style="text-align:right">{s['median']}</td>
          <td style="text-align:right">{s['p95']}</td>
          <td style="text-align:right">{s['p99']}</td>
          <td style="text-align:right">{s['max']}</td>
          <td style="text-align:right;color:{color};font-weight:600">{err_count} ({err_pct:.1f}%)</td>
        </tr>"""

    # Scenari
    scenario_rows = ""
    for name, label in [("A", "Sustained Load"), ("B", "Spike"), ("C", "Mixed Workload"), ("D", "AI Routing")]:
        times = metrics.scenario_times.get(name)
        if not times:
            continue
        start, end = times
        duration = (end - start).total_seconds() if end else 0
        errs = len([e for e in metrics.errors if e["scenario"] == name])
        # Conta richieste totali in quel scenario
        total_reqs = sum(
            len([t for t in metrics.response_times.get(ep, [])])
            for ep in metrics.response_times
        )
        scenario_rows += f"""
        <tr>
          <td style="font-weight:600">Scenario {name} — {label}</td>
          <td style="text-align:right">{start.strftime('%H:%M:%S') if start else '-'}</td>
          <td style="text-align:right">{end.strftime('%H:%M:%S') if end else '-'}</td>
          <td style="text-align:right">{duration:.1f}s</td>
          <td style="text-align:right;color:{'#dc2626' if errs > 0 else '#16a34a'}">{errs}</td>
        </tr>"""

    # Errori dettaglio (primi 100)
    error_rows = ""
    for e in metrics.errors[:100]:
        error_rows += f"""
        <tr>
          <td>{e['ts']}</td>
          <td>{e['scenario']}</td>
          <td>{e['endpoint']}</td>
          <td style="text-align:center">{e['status']}</td>
          <td class="error-detail">{e['detail']}</td>
        </tr>"""

    # Statistiche globali
    total_requests = sum(len(v) for v in metrics.response_times.values())
    total_errors = len(metrics.errors)
    all_times = []
    for v in metrics.response_times.values():
        all_times.extend(v)
    global_avg = round(statistics.mean(all_times), 1) if all_times else 0
    global_p95 = round(sorted(all_times)[int(len(all_times) * 0.95)], 1) if len(all_times) > 1 else 0

    html = f"""<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Stress Test Report — FTC HUB Ticketing</title>
<style>
  * {{ margin: 0; padding: 0; box-sizing: border-box; }}
  body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f8fafc; color: #1e293b; }}
  .header {{ background: #1e3a5f; color: white; padding: 24px 32px; }}
  .header h1 {{ font-size: 22px; font-weight: 700; }}
  .header p {{ font-size: 13px; opacity: 0.7; margin-top: 4px; }}
  .container {{ max-width: 1200px; margin: 24px auto; padding: 0 24px; }}
  .stats-grid {{ display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px; }}
  .stat-card {{ background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; text-align: center; }}
  .stat-value {{ font-size: 28px; font-weight: 800; color: #1e3a5f; }}
  .stat-label {{ font-size: 12px; color: #64748b; margin-top: 4px; text-transform: uppercase; letter-spacing: 0.5px; }}
  .card {{ background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin-bottom: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.04); }}
  .card h2 {{ font-size: 16px; font-weight: 700; color: #1e3a5f; margin-bottom: 16px; padding-bottom: 10px; border-bottom: 2px solid #e2e8f0; }}
  table {{ width: 100%; border-collapse: collapse; font-size: 13px; }}
  th {{ background: #f1f5f9; color: #475569; font-weight: 600; text-align: left; padding: 10px 12px; border-bottom: 2px solid #e2e8f0; }}
  td {{ padding: 9px 12px; border-bottom: 1px solid #f1f5f9; }}
  tr:hover {{ background: #f8fafc; }}
  .error-detail {{ font-family: monospace; font-size: 11px; color: #dc2626; max-width: 400px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }}
  .badge {{ display: inline-block; font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 6px; }}
  .badge-green {{ background: #dcfce7; color: #16a34a; }}
  .badge-red {{ background: #fee2e2; color: #dc2626; }}
  .badge-amber {{ background: #fef3c7; color: #d97706; }}
  .footer {{ text-align: center; padding: 20px; color: #94a3b8; font-size: 12px; }}
  @media print {{ body {{ background: white; }} .header {{ -webkit-print-color-adjust: exact; print-color-adjust: exact; }} }}
</style>
</head>
<body>

<div class="header">
  <h1>Stress Test Report — Modulo Ticketing</h1>
  <p>FTC HUB &middot; {now} &middot; Target: {BASE_URL}</p>
</div>

<div class="container">

  <!-- Stats globali -->
  <div class="stats-grid">
    <div class="stat-card">
      <div class="stat-value">{total_requests:,}</div>
      <div class="stat-label">Richieste totali</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">{total_errors:,}</div>
      <div class="stat-label">Errori totali</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">{global_avg} ms</div>
      <div class="stat-label">Latenza media</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">{global_p95} ms</div>
      <div class="stat-label">P95 latenza</div>
    </div>
  </div>

  <!-- Scenari -->
  <div class="card">
    <h2>Scenari eseguiti</h2>
    <table>
      <thead>
        <tr>
          <th>Scenario</th>
          <th style="text-align:right">Inizio</th>
          <th style="text-align:right">Fine</th>
          <th style="text-align:right">Durata</th>
          <th style="text-align:right">Errori</th>
        </tr>
      </thead>
      <tbody>{scenario_rows}</tbody>
    </table>
  </div>

  <!-- Dettaglio endpoint -->
  <div class="card">
    <h2>Performance per endpoint (tempi in ms)</h2>
    <table>
      <thead>
        <tr>
          <th>Endpoint</th>
          <th style="text-align:right">Richieste</th>
          <th style="text-align:right">Min</th>
          <th style="text-align:right">Avg</th>
          <th style="text-align:right">Median</th>
          <th style="text-align:right">P95</th>
          <th style="text-align:right">P99</th>
          <th style="text-align:right">Max</th>
          <th style="text-align:right">Errori</th>
        </tr>
      </thead>
      <tbody>{endpoint_rows}</tbody>
    </table>
  </div>

  <!-- Errori -->
  <div class="card">
    <h2>Errori ({total_errors} totali{', primi 100 mostrati' if total_errors > 100 else ''})</h2>
    {f'''<table>
      <thead>
        <tr>
          <th style="width:70px">Ora</th>
          <th style="width:40px">Sc.</th>
          <th>Endpoint</th>
          <th style="width:60px;text-align:center">Status</th>
          <th>Dettaglio</th>
        </tr>
      </thead>
      <tbody>{error_rows}</tbody>
    </table>''' if error_rows else '<p style="color:#94a3b8;font-size:13px">Nessun errore registrato.</p>'}
  </div>

  <!-- Configurazione usata -->
  <div class="card">
    <h2>Configurazione test</h2>
    <table>
      <tbody>
        <tr><td style="font-weight:600;width:250px">Target URL</td><td>{BASE_URL}</td></tr>
        <tr><td style="font-weight:600">Utenti autenticati</td><td>{len(user_tokens)}</td></tr>
        <tr><td style="font-weight:600">Categorie</td><td>{len(categories)}</td></tr>
        <tr><td style="font-weight:600">Scenario A</td><td>{SA_TOTAL_TICKETS} ticket in {SA_DURATION_SEC}s + {SA_COMMENTS_RANGE[0]}-{SA_COMMENTS_RANGE[1]} commenti + {SA_ATTACHMENTS_RANGE[0]}-{SA_ATTACHMENTS_RANGE[1]} allegati da {SA_ATTACHMENT_SIZE // 1024}KB</td></tr>
        <tr><td style="font-weight:600">Scenario B</td><td>{SB_SIMULTANEOUS} ticket simultanei</td></tr>
        <tr><td style="font-weight:600">Scenario C</td><td>{SC_CONCURRENT_USERS} utenti per {SC_DURATION_SEC}s (mix create/status/comment/list)</td></tr>
        <tr><td style="font-weight:600">Scenario D</td><td>{SD_TOTAL_TICKETS} ticket con analisi AI (Claude Haiku 4.5), concurrency {SD_CONCURRENCY}</td></tr>
        <tr><td style="font-weight:600">Max concurrency</td><td>{MAX_CONCURRENT_REQUESTS}</td></tr>
      </tbody>
    </table>
  </div>

</div>

<div class="footer">
  FTC HUB Stress Test &middot; Generato automaticamente &middot; {now}
</div>

</body>
</html>"""

    report_path = Path("stress_test_report.html")
    report_path.write_text(html, encoding="utf-8")
    print(f"\n  Report salvato: {report_path.resolve()}")
    return report_path


# ═══════════════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════════════

async def main():
    print()
    print("╔══════════════════════════════════════════════════════════╗")
    print("║   FTC HUB — Stress Test Modulo Ticketing                ║")
    print("║   Target: " + BASE_URL.ljust(46) + " ║")
    print("╚══════════════════════════════════════════════════════════╝")

    # Disabilita warning SSL
    import warnings
    import urllib3
    warnings.filterwarnings("ignore", category=DeprecationWarning)
    urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

    limits = httpx.Limits(
        max_connections=MAX_CONCURRENT_REQUESTS + 10,
        max_keepalive_connections=MAX_CONCURRENT_REQUESTS,
    )

    async with httpx.AsyncClient(verify=VERIFY_SSL, limits=limits) as client:
        # Setup
        await setup(client)

        # Seleziona scenari da eseguire e override parametri
        only = set()
        args = sys.argv[1:]
        i = 0
        while i < len(args):
            if args[i] == "--tickets" and i + 1 < len(args):
                global SA_TOTAL_TICKETS, SB_SIMULTANEOUS, SD_TOTAL_TICKETS
                n = int(args[i + 1])
                SA_TOTAL_TICKETS = n
                SB_SIMULTANEOUS = min(n, SB_SIMULTANEOUS)
                SD_TOTAL_TICKETS = min(n, SD_TOTAL_TICKETS)
                i += 2
                continue
            if args[i] == "--duration" and i + 1 < len(args):
                global SA_DURATION_SEC
                SA_DURATION_SEC = int(args[i + 1])
                i += 2
                continue
            for ch in args[i].upper().replace(",", ""):
                if ch in "ABCD":
                    only.add(ch)
            i += 1

        if only:
            print(f"  Scenari selezionati: {', '.join(sorted(only))}\n")
        else:
            print("  Tutti gli scenari (A, B, C, D)\n")

        input("  Premi INVIO per avviare i test (o Ctrl+C per uscire)...\n")

        # Scenario A
        if not only or "A" in only:
            try:
                await scenario_a(client)
            except KeyboardInterrupt:
                print("\n  [SKIP] Scenario A interrotto")
            except Exception as e:
                print(f"\n  [ERRORE] Scenario A: {e}")

        # Scenario B
        if not only or "B" in only:
            try:
                await scenario_b(client)
            except KeyboardInterrupt:
                print("\n  [SKIP] Scenario B interrotto")
            except Exception as e:
                print(f"\n  [ERRORE] Scenario B: {e}")

        # Scenario C
        if not only or "C" in only:
            try:
                await scenario_c(client)
            except KeyboardInterrupt:
                print("\n  [SKIP] Scenario C interrotto")
            except Exception as e:
                print(f"\n  [ERRORE] Scenario C: {e}")

        # Scenario D
        if not only or "D" in only:
            try:
                await scenario_d(client)
            except KeyboardInterrupt:
                print("\n  [SKIP] Scenario D interrotto")
            except Exception as e:
                print(f"\n  [ERRORE] Scenario D: {e}")

    # Report
    print("\n" + "=" * 60)
    print("  GENERAZIONE REPORT")
    print("=" * 60)
    report_path = generate_report()

    # Apri il report nel browser
    try:
        os.startfile(str(report_path))
    except Exception:
        pass

    print("\n  Test completato!")
    print()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n\n  Test interrotto dall'utente.")
        if metrics.response_times:
            print("  Genero report parziale...")
            generate_report()
