"""
Servizio di compilazione guidata ticket tramite Claude Haiku.
Gestisce la conversazione, estrae i dati strutturati e segnala
quando il ticket è pronto per la creazione.
"""
import json
import re
from typing import Optional

import anthropic

from app.config import settings

_CLIENT: Optional[anthropic.AsyncAnthropic] = None


def get_client() -> anthropic.AsyncAnthropic:
    global _CLIENT
    if _CLIENT is None:
        if not settings.ANTHROPIC_API_KEY:
            raise RuntimeError("ANTHROPIC_API_KEY non configurata")
        _CLIENT = anthropic.AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)
    return _CLIENT


def is_available() -> bool:
    return bool(settings.ANTHROPIC_API_KEY)


def _build_system_prompt(categories: list[dict]) -> str:
    cat_lines = []
    for cat in categories:
        subs = cat.get("subcategories", [])
        if subs:
            sub_names = ", ".join(f"{s['name']} (id:{s['id']})" for s in subs)
            cat_lines.append(f"  - {cat['name']} (id:{cat['id']}) → sottocategorie: {sub_names}")
        else:
            cat_lines.append(f"  - {cat['name']} (id:{cat['id']})")
    cats_block = "\n".join(cat_lines)

    return f"""Sei il servizio Helpdesk IT di Flying Tiger Copenhagen. Il tuo unico scopo è raccogliere le informazioni per aprire un ticket di supporto.

Categorie disponibili:
{cats_block}

Informazioni da raccogliere:
1. Descrizione del problema (dal primo messaggio dell'utente)
2. Eventuale chiarimento se il problema non è chiaro
3. Numero di telefono del richiedente
4. Codice TeamViewer (SOLO se il problema riguarda un computer, software o accesso remoto)
5. Se utile per diagnosticare il problema, chiedi se hanno uno screenshot o foto da allegare

Linee guida:
- Fai UNA sola domanda alla volta
- Risposte brevissime — meno parole possibile
- Tono diretto, zero fronzoli
- Se il messaggio non c'entra nulla con un problema IT o del negozio: prima volta rispondi con sarcasmo secco e riporta al punto; alla seconda volta fuori contesto chiudi con "Sono molto impegnato. Per esistenziali contatta UnoBravo: unobravo.com" e non aggiungere altro
- Deduci categoria, sottocategoria e priorità dal contesto — NON chiederle all'utente
- La priorità va valutata così: critical=blocco totale attività negozio, high=problema grave ma workaround possibile, medium=disagio operativo, low=richiesta non urgente
- Il codice TeamViewer chiedilo solo se pertinente al problema
- Quando hai raccolto tutte le informazioni necessarie, rispondi ESCLUSIVAMENTE con un JSON nel seguente formato (nessun testo prima o dopo):

{{
  "complete": true,
  "summary": "Messaggio di conferma amichevole da mostrare all'utente prima che confermi",
  "title": "Titolo breve e descrittivo del ticket",
  "description": "Descrizione strutturata e completa del problema, in italiano",
  "category_id": <intero>,
  "subcategory_id": <intero o null>,
  "priority": "low|medium|high|critical",
  "requester_phone": "<numero o stringa vuota>",
  "teamviewer_code": "<codice o stringa vuota>",
  "needs_attachment": <true se hai chiesto un allegato e l'utente ha detto sì, altrimenti false>
}}

Non aggiungere mai markdown, backtick o testo fuori dal JSON quando sei pronto."""


async def analyze_ticket(
    title: str,
    description: str,
    categories: list[dict],
    teams: list[dict],
) -> dict:
    """
    Analizza il ticket in una sola chiamata:
    - Verifica pertinenza (soglia media)
    - Suggerisce 2-3 team dalla lista fissa
    - Migliora la descrizione
    - Suggerisce categoria, sottocategoria e priorità

    Ritorna:
      { "relevant": False, "rejection_reason": "..." }
    oppure:
      { "relevant": True, "suggested_teams": [...], "enhanced_description": "...",
        "category_id": int, "subcategory_id": int|None, "priority": str }
    """
    if not is_available():
        return {"relevant": True, "suggested_teams": [], "enhanced_description": description,
                "category_id": categories[0]["id"] if categories else None,
                "subcategory_id": None, "priority": "medium"}

    client = get_client()

    cat_lines = []
    for cat in categories:
        subs = cat.get("subcategories", [])
        if subs:
            sub_str = ", ".join(f"{s['name']}(id:{s['id']})" for s in subs)
            cat_lines.append(f"  {cat['name']}(id:{cat['id']}): {sub_str}")
        else:
            cat_lines.append(f"  {cat['name']}(id:{cat['id']})")
    cats_block = "\n".join(cat_lines)
    teams_block = " | ".join(t["name"] for t in teams)

    teams_lines = []
    for t in teams:
        if t.get("description"):
            teams_lines.append(f'- {t["name"]}: {t["description"]}')
        else:
            teams_lines.append(f'- {t["name"]} (nessuna competenza configurata: usa il nome per dedurre cosa gestisce)')
    teams_desc_block = "\n".join(teams_lines)

    system = f"""Sei un analizzatore di ticket per Flying Tiger Copenhagen.
Analizza il ticket e rispondi SOLO con un JSON, niente altro.

Team disponibili e loro competenze:
{teams_desc_block}

Nomi esatti da usare nel JSON: {teams_block}

Categorie disponibili:
{cats_block}

Regole:
- Pertinente = qualsiasi richiesta o segnalazione legata al lavoro
- Non pertinente = messaggi personali, spam, test, testo senza senso
- suggested_teams: 1-2 team massimo, solo quelli realmente competenti. Se il problema è chiaramente di un solo team, mettine solo 1.
- Se un team non ha competenze configurate, usa il nome per dedurre di cosa si occupa.
- priority: critical=blocco totale negozio, high=problema grave, medium=disagio operativo, low=non urgente
- enhanced_description: riscrivi in modo chiaro e professionale, mantieni tutti i fatti, niente markdown

Se NON pertinente:
{{"relevant": false, "rejection_reason": "messaggio breve in italiano che spiega perché"}}

Se pertinente:
{{"relevant": true, "suggested_teams": ["TEAM1"], "enhanced_description": "...", "category_id": <int>, "subcategory_id": <int|null>, "priority": "low|medium|high|critical"}}"""

    response = await client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=512,
        system=system,
        messages=[{"role": "user", "content": f"Titolo: {title}\nDescrizione: {description}"}],
    )

    content = response.content[0].text.strip()
    json_match = re.search(r'\{[\s\S]*\}', content)
    if json_match:
        try:
            return json.loads(json_match.group())
        except json.JSONDecodeError:
            pass

    # fallback se JSON malformato
    return {"relevant": True, "suggested_teams": [], "enhanced_description": description,
            "category_id": categories[0]["id"] if categories else None,
            "subcategory_id": None, "priority": "medium"}


async def enhance_description(title: str, description: str) -> str:
    """
    Riscrive la descrizione del ticket in modo strutturato e professionale.
    In caso di errore restituisce la descrizione originale.
    """
    if not is_available():
        return description

    try:
        client = get_client()
        response = await client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=512,
            system=(
                "Sei un assistente tecnico IT. Riscrivi la descrizione del ticket di supporto "
                "in modo chiaro, strutturato e professionale, in italiano. "
                "Mantieni tutte le informazioni originali, non inventare nulla. "
                "Niente titoli, niente markdown, solo testo scorrevole. "
                "Se la descrizione è già chiara, migliorala appena. "
                "Rispondi SOLO con la descrizione riscritta, nient'altro."
            ),
            messages=[
                {
                    "role": "user",
                    "content": f"Titolo ticket: {title}\n\nDescrizione originale: {description}",
                }
            ],
        )
        return response.content[0].text.strip() or description
    except Exception:
        return description


async def chat(
    messages: list[dict],
    categories: list[dict],
) -> dict:
    """
    Invia un turno di conversazione a Claude Haiku.
    Restituisce:
      { "reply": str, "complete": False }
    oppure quando pronto:
      { "reply": str, "complete": True, "ticket_data": dict }
    """
    client = get_client()

    system_prompt = _build_system_prompt(categories)

    response = await client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=1024,
        system=system_prompt,
        messages=messages,
    )

    content = response.content[0].text.strip()

    # Prova a estrarre JSON (potrebbe essere wrapped in backtick)
    json_match = re.search(r'\{[\s\S]*\}', content)
    if json_match:
        try:
            data = json.loads(json_match.group())
            if data.get("complete"):
                return {
                    "reply": data.get("summary", "Perfetto, ho tutto quello che mi serve!"),
                    "complete": True,
                    "ticket_data": {
                        "title": data["title"],
                        "description": data["description"],
                        "category_id": data["category_id"],
                        "subcategory_id": data.get("subcategory_id"),
                        "priority": data["priority"],
                        "requester_phone": data.get("requester_phone", ""),
                        "teamviewer_code": data.get("teamviewer_code", ""),
                        "needs_attachment": data.get("needs_attachment", False),
                    },
                }
        except (json.JSONDecodeError, KeyError):
            pass

    return {"reply": content, "complete": False}
