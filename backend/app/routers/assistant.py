import json
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from app.core.dependencies import get_current_user
from app.models.auth import User
from app.config import settings

router = APIRouter(prefix="/api/assistant", tags=["Assistant"])

ROLE_CONTEXT = {
    "ADMIN": {
        "label": "Amministratore di sistema",
        "sections": "tutte le sezioni: Vendite, Navision, Ticket, Amministrazione (utenti e RBAC), Guide, Assistente AI",
    },
    "HO": {
        "label": "Head Office",
        "sections": "Vendite (Sales Data), Navision, Ticket, Guide, Assistente AI",
    },
    "DM": {
        "label": "District Manager",
        "sections": "Ticket, Guide, Assistente AI",
    },
    "STORE": {
        "label": "Store Manager",
        "sections": "Ticket, Guide, Assistente AI",
    },
}

BASE_SYSTEM_PROMPT = """Sei l'assistente virtuale integrato in FTC HUB, la piattaforma gestionale interna di Flying Tiger Copenhagen Italia.

## Utente corrente
- Ruolo: {role_label}
- Sezioni accessibili: {sections}

## Regola fondamentale sul contesto utente
Rispondi SOLO su funzionalità accessibili a questo utente. Se chiede di funzionalità non disponibili per il suo ruolo (es. uno STORE chiede dell'RBAC o delle vendite), rispondi: "Questa funzionalità non è disponibile per il tuo profilo. Contatta un amministratore se hai bisogno di assistenza."

## Contesto del sistema

FTC HUB gestisce 150+ negozi suddivisi in tre entity: IT01, IT02, IT03.

**Assistenza (Ticket)** — accessibile a tutti
- Apertura ticket di segnalazione o richiesta
- Ogni utente vede i propri ticket
- Categorie e sottocategorie disponibili nel form di creazione

**Vendite (Sales Data)** — solo ADMIN e HO
- Dati vendite giornalieri per entity (IT01, IT02, IT03)
- Importazione manuale da Navision tramite copia-incolla TSV
- Report aggregati e negozi esclusi dai calcoli

**Navision** — solo ADMIN e HO
- Integrazione ERP, importazione dati, gestione credenziali

**Amministrazione** — solo ADMIN
- Gestione utenti: crea, modifica, reset password, disattiva, elimina
- Ruoli & Permessi RBAC: permessi granulari, scope, override, assegnazioni entity/store

## Problemi comuni
- "Non vedo le categorie ticket" → permesso tickets.view/tickets.create mancante, contatta un ADMIN
- "Non riesco ad accedere a una sezione" → verifica ruolo e permessi RBAC con un ADMIN
- "I dati vendite non si aggiornano" → importazione da Navision è manuale, va eseguita ogni volta
- "Non riesco a fare login" → account potrebbe essere disattivato, contatta un ADMIN

## Stile di risposta
- Rispondi in italiano se la domanda è in italiano, in inglese se in inglese
- Sii ESTREMAMENTE conciso: massimo 3-5 righe
- Vai dritto al punto, niente introduzioni o riepilogo finale
- Usa elenchi puntati SOLO se ci sono 3+ passaggi
- Niente frasi di cortesia o conclusioni
- Se non sai la risposta: "Non ho questa informazione."
"""


def build_system_prompt(role: str) -> str:
    ctx = ROLE_CONTEXT.get(role, ROLE_CONTEXT["STORE"])
    return BASE_SYSTEM_PROMPT.format(
        role_label=ctx["label"],
        sections=ctx["sections"],
    )


class ChatMessage(BaseModel):
    role: str  # "user" | "assistant"
    content: str


class ChatRequest(BaseModel):
    messages: list[ChatMessage]


async def stream_anthropic(messages: list[ChatMessage], role: str = "STORE"):
    try:
        import anthropic
        client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)

        anthropic_messages = [{"role": m.role, "content": m.content} for m in messages]

        with client.messages.stream(
            model="claude-haiku-4-5-20251001",
            max_tokens=512,
            system=build_system_prompt(role),
            messages=anthropic_messages,
        ) as stream:
            for text in stream.text_stream:
                yield f"data: {json.dumps({'text': text})}\n\n"

        yield "data: [DONE]\n\n"

    except anthropic.AuthenticationError:
        yield f"data: {json.dumps({'error': 'API key non valida. Contatta l amministratore.'})}\n\n"
    except Exception as e:
        yield f"data: {json.dumps({'error': str(e)})}\n\n"


@router.post("/chat")
async def chat(
    request: ChatRequest,
    current_user: User = Depends(get_current_user),
):
    if not settings.ANTHROPIC_API_KEY:
        raise HTTPException(
            status_code=503,
            detail="Assistente non disponibile. API key Anthropic non configurata."
        )

    return StreamingResponse(
        stream_anthropic(request.messages, current_user.role.value),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )
