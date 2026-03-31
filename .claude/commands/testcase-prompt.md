# Genera prompt per documento test cases HTML

Genera un prompt completo da incollare in una nuova chat con Claude per creare un documento HTML interattivo di test cases per FTC HUB.

Il documento deve seguire **esattamente** lo stile e la struttura di `frontend/public/docs/test-ticket.html`.

---

## Prompt da generare

Il prompt deve:

1. **Specificare il titolo e l'area** del documento (es. "Gestione Utenti", "Login", ecc.) fornita dall'utente con il comando.

2. **Includere il template HTML completo** con:
   - CSS identico a `test-ticket.html` (palette `#1e3a5f`, sfondo `#f8fafc`, card bianche)
   - Header blu con titolo, sottotitolo e bottone "← Indietro" verso `index.html`
   - Box intro con istruzioni per il tester
   - Progress bar dinamica con contatore globale e per sezione
   - Bottoni Reset e Stampa
   - Container `<div id="test-sections"></div>`

3. **Includere il JavaScript esatto** (NON modificarlo):
```javascript
let state = {};

function buildUI() {
  const container = document.getElementById("test-sections");
  TESTS.forEach((section, si) => {
    const div = document.createElement("div");
    div.className = "section";
    div.innerHTML = `
      <div class="section-header">
        <h2>${section.section}</h2>
        <span class="section-counter" id="counter-${si}">0/${section.items.length}</span>
      </div>
      <div class="section-body" id="body-${si}"></div>
    `;
    const body = div.querySelector(`#body-${si}`);
    section.items.forEach((item, ii) => {
      const key = `${si}-${ii}`;
      const itemDiv = document.createElement("div");
      itemDiv.className = "test-item";
      itemDiv.innerHTML = `
        <div class="test-row" onclick="toggleCheck('${key}')">
          <input type="checkbox" id="cb-${key}" onclick="event.stopPropagation(); toggleCheck('${key}')">
          <div class="test-content">
            <div class="test-action" id="action-${key}">${item.action}</div>
            <div class="test-expected">✓ Atteso: ${item.expected}</div>
            <div class="error-inline">
              <div class="error-code-badge">
                ⚠ Se non funziona, comunica il codice al Supporto:&nbsp;<span class="code">${item.code}</span>
              </div>
            </div>
          </div>
        </div>
      `;
      body.appendChild(itemDiv);
    });
    container.appendChild(div);
  });
  updateProgress();
}

function toggleCheck(key) {
  const cb = document.getElementById(`cb-${key}`);
  cb.checked = !cb.checked;
  state[key] = cb.checked;
  document.getElementById(`action-${key}`).classList.toggle("done", cb.checked);
  updateProgress();
}

function updateProgress() {
  const total = TESTS.reduce((a, s) => a + s.items.length, 0);
  const done = Object.values(state).filter(Boolean).length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  document.getElementById("progress-text").textContent = `${done} / ${total} (${pct}%)`;
  document.getElementById("progress-fill").style.width = pct + "%";
  TESTS.forEach((section, si) => {
    const count = section.items.filter((_, ii) => state[`${si}-${ii}`]).length;
    document.getElementById(`counter-${si}`).textContent = `${count}/${section.items.length}`;
  });
}

function resetAll() {
  state = {};
  document.querySelectorAll("input[type=checkbox]").forEach(cb => cb.checked = false);
  document.querySelectorAll(".test-action").forEach(el => el.classList.remove("done"));
  updateProgress();
}

buildUI();
```

4. **Specificare la struttura dell'array TESTS**:
```javascript
const TESTS = [
  {
    section: "1. Nome sezione",
    items: [
      {
        action: "Descrizione azione da eseguire (linguaggio semplice, per non tecnici)",
        expected: "Risultato atteso se il test passa",
        code: "XXX-0001"   // prefisso area + numero progressivo
      },
    ]
  },
];
```

5. **Richiedere almeno 40 test cases** organizzati per sezioni funzionali, in italiano, con:
   - Casi positivi (happy path)
   - Casi negativi (errori attesi)
   - Linguaggio semplice per tester non tecnici
   - Codici errore progressivi con prefisso coerente all'area

6. **Output atteso**: file HTML completo, standalone, pronto da salvare in `frontend/public/docs/test-[nome].html`

---

## Come usare questo comando

```
/testcase-prompt [area] [prefisso-codice] [sezioni]
```

Esempio:
```
/testcase-prompt "Gestione Utenti" "USR" "Login, Creazione, Modifica, Disattivazione, Profilo, Lista, Permessi"
```

Se l'utente non fornisce argomenti, chiedi: area funzionale, prefisso codice errore e sezioni da coprire.
