"""
Servizio AI per analisi e compilazione ticket.

Provider supportati:
  - ollama    : LLM on-premise via Ollama (privacy totale, zero costi)
  - anthropic : Claude Haiku via API Anthropic (fallback cloud)
  - auto      : prova Ollama, se non disponibile usa Anthropic

Configurazione in .env:
  AI_PROVIDER=auto
  OLLAMA_BASE_URL=http://ollama:11434
  OLLAMA_MODEL=mistral
  ANTHROPIC_API_KEY=sk-ant-...
"""
import json
import re
import logging
from typing import Optional

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

# ── Client Anthropic (lazy init) ──────────────────────────────────────────────

_anthropic_client = None


def _get_anthropic_client():
    global _anthropic_client
    if _anthropic_client is None:
        import anthropic
        if not settings.ANTHROPIC_API_KEY:
            raise RuntimeError("ANTHROPIC_API_KEY non configurata")
        _anthropic_client = anthropic.AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)
    return _anthropic_client


# ── Disponibilità provider ────────────────────────────────────────────────────

def _ollama_configured() -> bool:
    return bool(settings.OLLAMA_BASE_URL)


def _anthropic_configured() -> bool:
    return bool(settings.ANTHROPIC_API_KEY)


def is_available() -> bool:
    """Almeno un provider è configurato."""
    return _ollama_configured() or _anthropic_configured()


async def _ollama_reachable() -> bool:
    """Verifica che Ollama risponda (health check rapido)."""
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            r = await client.get(f"{settings.OLLAMA_BASE_URL}/api/tags")
            return r.status_code == 200
    except Exception:
        return False


async def _resolve_provider() -> str:
    """
    Risolve il provider effettivo in base ad AI_PROVIDER:
      - "ollama"    → usa Ollama (errore se non disponibile)
      - "anthropic" → usa Anthropic (errore se non configurato)
      - "auto"      → Ollama se raggiungibile, altrimenti Anthropic
    """
    provider = settings.AI_PROVIDER.lower()

    if provider == "ollama":
        return "ollama"
    if provider == "anthropic":
        return "anthropic"

    # auto: preferisce Ollama
    if _ollama_configured() and await _ollama_reachable():
        logger.info("AI provider: Ollama (%s)", settings.OLLAMA_MODEL)
        return "ollama"

    if _anthropic_configured():
        logger.info("AI provider: Anthropic (fallback)")
        return "anthropic"

    raise RuntimeError("Nessun provider AI disponibile (Ollama non raggiungibile, Anthropic non configurato)")


# ── Chiamate ai provider ──────────────────────────────────────────────────────

async def _call_ollama(system: str, user: str) -> str:
    """Chiama Ollama e restituisce il testo della risposta."""
    prompt = f"<s>[INST] <<SYS>>\n{system}\n<</SYS>>\n\n{user} [/INST]"
    async with httpx.AsyncClient(timeout=60.0) as client:
        r = await client.post(
            f"{settings.OLLAMA_BASE_URL}/api/generate",
            json={
                "model": settings.OLLAMA_MODEL,
                "prompt": prompt,
                "stream": False,
                "format": "json",
                "options": {"temperature": 0.1, "num_predict": 512},
            },
        )
        r.raise_for_status()
        return r.json()["response"].strip()


async def _call_anthropic(system: str, user: str, max_tokens: int = 512) -> str:
    """Chiama Claude Haiku e restituisce il testo della risposta."""
    client = _get_anthropic_client()
    response = await client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=max_tokens,
        system=system,
        messages=[{"role": "user", "content": user}],
    )
    return response.content[0].text.strip()


async def _call_ai(system: str, user: str, max_tokens: int = 512) -> str:
    """Chiama il provider attivo con fallback automatico."""
    provider = await _resolve_provider()
    if provider == "ollama":
        return await _call_ollama(system, user)
    return await _call_anthropic(system, user, max_tokens)


# ── Prompt builder ────────────────────────────────────────────────────────────

def _build_teams_block(teams: list[dict]) -> tuple[str, str]:
    """Restituisce (teams_desc_block, teams_names_block)."""
    lines = []
    for t in teams:
        if t.get("description"):
            lines.append(f'- {t["name"]}: {t["description"]}')
        else:
            lines.append(f'- {t["name"]} (usa il nome per dedurre le competenze)')
    return "\n".join(lines), " | ".join(t["name"] for t in teams)


def _build_cats_block(categories: list[dict]) -> str:
    lines = []
    for cat in categories:
        subs = cat.get("subcategories", [])
        if subs:
            sub_str = ", ".join(f"{s['name']}(id:{s['id']})" for s in subs)
            lines.append(f"  {cat['name']}(id:{cat['id']}): {sub_str}")
        else:
            lines.append(f"  {cat['name']}(id:{cat['id']})")
    return "\n".join(lines)


def _build_chat_system(categories: list[dict]) -> str:
    cats_block = "\n".join(
        f"  - {c['name']} (id:{c['id']}) → " +
        ", ".join(f"{s['name']} (id:{s['id']})" for s in c.get("subcategories", []))
        if c.get("subcategories") else f"  - {c['name']} (id:{c['id']})"
        for c in categories
    )
    return f"""Sei il servizio Helpdesk di Flying Tiger Copenhagen. Raccogli le informazioni per aprire un ticket.

Categorie disponibili:
{cats_block}

Linee guida:
- Fai UNA sola domanda alla volta
- Risposte brevissime, tono diretto
- Se fuori contesto: prima volta sarcasmo secco; seconda volta chiudi con "Sono molto impegnato. Per esistenziali contatta UnoBravo: unobravo.com"
- Deduci categoria, sottocategoria e priorità — NON chiederle
- priority: critical=blocco totale negozio, high=grave, medium=disagio, low=non urgente
- TeamViewer: chiedilo SOLO per problemi su computer/software/accesso remoto
- Quando hai tutto, rispondi SOLO con questo JSON (niente testo prima/dopo):

{{"complete": true, "summary": "messaggio conferma", "title": "titolo breve", "description": "descrizione completa", "category_id": <int>, "subcategory_id": <int|null>, "priority": "low|medium|high|critical", "requester_phone": "<numero>", "teamviewer_code": "<codice o stringa vuota>", "needs_attachment": false}}"""


# ── API pubblica ──────────────────────────────────────────────────────────────

async def analyze_ticket(
    title: str,
    description: str,
    categories: list[dict],
    teams: list[dict],
) -> dict:
    """
    Analizza il ticket: verifica pertinenza, suggerisce team,
    migliora la descrizione, suggerisce categoria e priorità.
    """
    if not is_available():
        return {
            "relevant": True, "suggested_teams": [],
            "enhanced_description": description,
            "category_id": categories[0]["id"] if categories else None,
            "subcategory_id": None, "priority": "medium",
        }

    teams_desc, teams_names = _build_teams_block(teams)
    cats_block = _build_cats_block(categories)

    system = f"""Sei un analizzatore di ticket per Flying Tiger Copenhagen.
Analizza il ticket e rispondi SOLO con un JSON valido, niente altro.

Team disponibili e competenze:
{teams_desc}

Nomi esatti da usare nel JSON: {teams_names}

Categorie disponibili:
{cats_block}

Regole:
- Pertinente = qualsiasi richiesta lavorativa
- Non pertinente = messaggi personali, spam, test, testo senza senso
- suggested_teams: 1-2 team massimo, solo quelli competenti
- priority: critical=blocco totale negozio, high=grave, medium=disagio, low=non urgente
- enhanced_description: riscrivi in modo chiaro e professionale, niente markdown

Se NON pertinente:
{{"relevant": false, "rejection_reason": "spiegazione breve in italiano"}}

Se pertinente:
{{"relevant": true, "suggested_teams": ["TEAM1"], "enhanced_description": "...", "category_id": <int>, "subcategory_id": <int|null>, "priority": "low|medium|high|critical"}}"""

    user = f"Titolo: {title}\nDescrizione: {description}"

    content = await _call_ai(system, user)
    json_match = re.search(r'\{[\s\S]*\}', content)
    if json_match:
        try:
            return json.loads(json_match.group())
        except json.JSONDecodeError:
            pass

    return {
        "relevant": True, "suggested_teams": [],
        "enhanced_description": description,
        "category_id": categories[0]["id"] if categories else None,
        "subcategory_id": None, "priority": "medium",
    }


async def enhance_description(title: str, description: str) -> str:
    """Riscrive la descrizione in modo strutturato e professionale."""
    if not is_available():
        return description
    try:
        system = (
            "Sei un assistente tecnico. Riscrivi la descrizione del ticket in modo chiaro, "
            "strutturato e professionale, in italiano. Mantieni tutti i fatti originali. "
            "Niente titoli, niente markdown, solo testo scorrevole. "
            "Rispondi SOLO con la descrizione riscritta."
        )
        result = await _call_ai(system, f"Titolo: {title}\n\nDescrizione: {description}")
        return result or description
    except Exception:
        return description


async def chat(messages: list[dict], categories: list[dict]) -> dict:
    """Gestisce un turno di conversazione per la raccolta dati ticket."""
    system = _build_chat_system(categories)
    user_content = messages[-1]["content"] if messages else ""

    # Passa tutti i messaggi precedenti come contesto nel prompt utente
    if len(messages) > 1:
        history = "\n".join(
            f"{'Utente' if m['role'] == 'user' else 'Assistente'}: {m['content']}"
            for m in messages[:-1]
        )
        user_content = f"Storico conversazione:\n{history}\n\nNuovo messaggio utente: {user_content}"

    content = await _call_ai(system, user_content, max_tokens=1024)

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
