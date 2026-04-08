"""
AI Analyst — esegue query SQL generate dall'AI sui dati ticket.
Usa un utente PostgreSQL read-only per sicurezza.
"""
import re
import json
import logging
import asyncio
from datetime import datetime

import anthropic
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy import text

from app.config import settings

logger = logging.getLogger(__name__)

# ── Engine read-only (lazy init) ──────────────────────────────────────────────
_ro_engine = None
_ro_session_factory = None

SQL_BLOCKED_KEYWORDS = re.compile(
    r"\b(INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE|CREATE|GRANT|REVOKE|EXECUTE|COPY)\b",
    re.IGNORECASE,
)

MAX_QUERY_TIMEOUT_SEC = 5
MAX_RESULT_ROWS = 100

# Schema del DB ticket per il prompt (semplificato)
DB_SCHEMA = """
Schema: tickets
Tabelle:
- tickets.tickets (id UUID, ticket_number INT, title TEXT, description TEXT, category_id INT, subcategory_id INT, team_id INT, priority tickets.ticketpriority ENUM(low,medium,high,critical), status tickets.ticketstatus ENUM(open,in_progress,waiting,closed), store_number VARCHAR, requester_name VARCHAR, requester_email VARCHAR, created_by UUID, assigned_to UUID, is_active BOOL, created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ, closed_at TIMESTAMPTZ, taken_at TIMESTAMPTZ, resolution_minutes INT, has_solution BOOL)
- tickets.ticket_categories (id INT, name VARCHAR, is_active BOOL)
- tickets.ticket_subcategories (id INT, category_id INT, name VARCHAR, is_active BOOL)
- tickets.ticket_teams (id INT, name VARCHAR, is_active BOOL)
- tickets.ticket_team_members (id INT, team_id INT, user_id UUID, is_team_lead BOOL)
- tickets.ticket_comments (id UUID, ticket_id UUID, author_id UUID, content TEXT, is_internal BOOL, created_at TIMESTAMPTZ)
- tickets.ticket_attachments (id UUID, ticket_id UUID, comment_id UUID, filename VARCHAR, file_size INT, mime_type VARCHAR, created_at TIMESTAMPTZ)

Schema: ho
Tabelle accessibili:
- ho.stores (store_number VARCHAR, store_name VARCHAR, entity VARCHAR, district VARCHAR, city VARCHAR, dm_name VARCHAR, sm_name VARCHAR, is_active BOOL)

Note:
- priority e status sono ENUM PostgreSQL: per confronti con stringhe usare CAST(campo AS TEXT)
- Le date sono timezone-aware (TIMESTAMPTZ)
- IMPORTANTE: usare SEMPRE timezone 'Europe/Rome' per le date, MAI UTC. Esempio: DATE(created_at AT TIME ZONE 'Europe/Rome') = CURRENT_DATE
- store_number nel ticket può contenere sia codici negozio (IT207) che nomi department (IT, COMMERCIAL) per utenti HO
- I ticket aperti hanno status IN ('open','in_progress','waiting')
- resolution_minutes = minuti tra taken_at e closed_at
"""


def _get_ro_session():
    global _ro_engine, _ro_session_factory
    if _ro_engine is None:
        _ro_engine = create_async_engine(
            settings.readonly_database_url,
            echo=False,
            pool_size=3,
            max_overflow=2,
        )
        _ro_session_factory = async_sessionmaker(
            _ro_engine, class_=AsyncSession, expire_on_commit=False
        )
    return _ro_session_factory


def _validate_sql(sql: str) -> str | None:
    """Valida la query SQL. Ritorna errore se non valida, None se OK."""
    sql_stripped = sql.strip().rstrip(";").strip()
    if not sql_stripped.upper().startswith("SELECT"):
        return "Solo query SELECT sono permesse"
    if SQL_BLOCKED_KEYWORDS.search(sql_stripped):
        return "La query contiene keyword non permesse"
    return None


async def _execute_readonly(sql: str) -> tuple[list[str], list[list]]:
    """Esegue una query SELECT read-only con timeout. Ritorna (columns, rows)."""
    SessionLocal = _get_ro_session()
    async with SessionLocal() as session:
        # Imposta timeout sulla connessione
        await session.execute(text(f"SET statement_timeout = '{MAX_QUERY_TIMEOUT_SEC * 1000}'"))
        result = await session.execute(text(sql))
        columns = list(result.keys())
        rows = [list(r) for r in result.fetchmany(MAX_RESULT_ROWS)]
        # Serializza valori non-JSON (UUID, datetime, ecc.)
        for row in rows:
            for i, val in enumerate(row):
                if isinstance(val, datetime):
                    row[i] = val.isoformat()
                elif not isinstance(val, (str, int, float, bool, type(None))):
                    row[i] = str(val)
        return columns, rows


async def ask(question: str, off_topic_count: int = 0) -> dict:
    """
    Riceve una domanda in linguaggio naturale, genera SQL via AI,
    lo esegue in read-only, e ritorna la risposta formattata.
    """
    if off_topic_count >= 3:
        return {
            "answer": "Mi sa che oggi non abbiamo voglia di lavorare, eh? 😄 Torno disponibile quando vorrai parlare di ticket. Ciao!",
            "sql": None,
            "data": None,
            "off_topic": True,
            "blocked": True,
        }

    if not settings.ANTHROPIC_API_KEY:
        return {"answer": "Chiave API Anthropic non configurata.", "sql": None, "data": None}

    client = anthropic.AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)

    # Step 1: genera SQL
    system_prompt = f"""Sei un analista dati SQL per il sistema di ticketing di Flying Tiger Copenhagen.
Ti viene fatta una domanda sui dati dei ticket. Genera UNA query SQL PostgreSQL per rispondere.

{DB_SCHEMA}

Regole:
- SOLO SELECT, mai INSERT/UPDATE/DELETE
- Usa CAST(campo AS TEXT) per confrontare priority e status con stringhe
- Rispondi SOLO con un JSON: {{"sql": "SELECT ...", "explanation": "spiegazione breve della query"}}
- Se la domanda non è relativa ai dati ticket o al lavoro, rispondi: {{"sql": null, "off_topic": true, "explanation": "risposta sarcastica ma simpatica in italiano che faccia capire che sei un analista di ticket, non un tuttologo. Sii ironico e divertente, poi suggerisci di tornare a parlare di ticket."}}
- Limita i risultati con LIMIT 20 se non specificato
- Usa nomi tabella completi con schema (tickets.tickets, tickets.ticket_categories, ecc.)
- Per date usa timezone-aware: NOW(), CURRENT_DATE, INTERVAL
- Per i negozi: store_number in tickets.tickets contiene il codice (es. IT207), ho.stores ha i dettagli"""

    try:
        msg = await client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=512,
            system=system_prompt,
            messages=[{"role": "user", "content": question}],
        )
        content = msg.content[0].text
    except Exception as e:
        logger.error(f"AI analyst - errore chiamata AI: {e}")
        return {"answer": f"Errore nella generazione della query: {e}", "sql": None, "data": None}

    # Parse JSON dalla risposta
    json_match = re.search(r'\{[\s\S]*\}', content)
    if not json_match:
        return {"answer": "L'AI non ha generato una risposta valida.", "sql": None, "data": None}

    try:
        ai_result = json.loads(json_match.group())
    except json.JSONDecodeError:
        return {"answer": "Errore nel parsing della risposta AI.", "sql": None, "data": None}

    sql = ai_result.get("sql")
    explanation = ai_result.get("explanation", "")

    if not sql:
        is_off_topic = ai_result.get("off_topic", False)
        return {"answer": explanation or "Domanda non pertinente ai dati ticket.", "sql": None, "data": None, "off_topic": is_off_topic}

    # Step 2: valida SQL
    error = _validate_sql(sql)
    if error:
        return {"answer": f"Query non sicura: {error}", "sql": sql, "data": None}

    # Step 3: esegui query
    try:
        columns, rows = await asyncio.wait_for(
            _execute_readonly(sql),
            timeout=MAX_QUERY_TIMEOUT_SEC + 2,
        )
    except asyncio.TimeoutError:
        return {"answer": "La query ha impiegato troppo tempo (timeout).", "sql": sql, "data": None}
    except Exception as e:
        logger.warning(f"AI analyst - errore esecuzione query: {e}")
        return {"answer": f"Errore nell'esecuzione della query: {str(e)[:200]}", "sql": sql, "data": None}

    # Step 4: fai interpretare i risultati all'AI
    data_summary = {"columns": columns, "rows": rows, "row_count": len(rows)}

    try:
        interpret_msg = await client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=1024,
            system="""Sei un analista dati di Flying Tiger Copenhagen. Ti vengono dati i risultati di una query SQL.
Rispondi in italiano in modo chiaro e conciso. Usa numeri e dati concreti.
Se i dati sono tabulari, formattali in modo leggibile.
Non mostrare SQL. Non dire "basandomi sui dati" — vai dritto al punto.""",
            messages=[{
                "role": "user",
                "content": f"Domanda: {question}\n\nRisultati query:\nColonne: {columns}\nRighe: {json.dumps(rows[:50], ensure_ascii=False)}",
            }],
        )
        answer = interpret_msg.content[0].text
    except Exception as e:
        # Fallback: mostra dati grezzi
        answer = f"{explanation}\n\nRisultati: {len(rows)} righe trovate."

    return {
        "answer": answer,
        "sql": sql,
        "data": data_summary,
    }
