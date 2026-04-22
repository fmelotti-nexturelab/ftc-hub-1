// ==UserScript==
// @name         FTC HUB — Aruba Crea Casella
// @namespace    https://hub.tigeritalia.com
// @version      3.1
// @description  Compila automaticamente il form "Crea casella" su Aruba Mail usando la coda da FTC HUB
// @author       FTC IT
// @match        https://webmail.aruba.it/new/management/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  const Q_KEY = 'ftchub_queue';
  const I_KEY = 'ftchub_index';
  const R_KEY       = 'ftchub_return';
  const RESULTS_KEY = 'ftchub_results';
  const PWD   = 'Tiger2023!';

  // ── Storage via sessionStorage ────────────────────────────────────────────────
  const getQueue  = () => { try { return JSON.parse(sessionStorage.getItem(Q_KEY) || '[]'); } catch { return []; } };
  const saveQueue = q  => sessionStorage.setItem(Q_KEY, JSON.stringify(q));
  const getIndex  = () => parseInt(sessionStorage.getItem(I_KEY) || '0', 10);
  const saveIndex = i  => sessionStorage.setItem(I_KEY, String(i));

  // ── Bootstrap dal hash URL ────────────────────────────────────────────────────
  const hash = location.hash;
  if (hash.startsWith('#ftchub=')) {
    try {
      const decoded = decodeURIComponent(escape(atob(hash.slice(8))));
      const parsed = JSON.parse(decoded);
      // Supporta sia formato legacy (array) che nuovo ({queue, returnUrl})
      if (Array.isArray(parsed)) {
        saveQueue(parsed);
      } else {
        saveQueue(parsed.queue || []);
        if (parsed.returnUrl) sessionStorage.setItem(R_KEY, parsed.returnUrl);
      }
      saveIndex(0);
      history.replaceState(null, '', location.pathname + location.search);
    } catch (e) {
      console.warn('[FTC HUB] hash parse error:', e);
    }
  }

  // ── Utilities base ────────────────────────────────────────────────────────────
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  function waitFor(fn, timeout = 8000) {
    return new Promise((resolve, reject) => {
      const end = Date.now() + timeout;
      (function poll() {
        const el = fn();
        if (el) return resolve(el);
        if (Date.now() > end) return reject(new Error('waitFor timeout'));
        setTimeout(poll, 200);
      })();
    });
  }

  // ── Shadow DOM traversal ──────────────────────────────────────────────────────
  // Raccoglie tutti gli elementi che corrispondono a `selector` attraverso shadow roots.
  // Traversa anche il shadowRoot del nodo radice stesso (es. ARU-SHEET-MODAL che
  // mette tutto il contenuto nel proprio shadow root, non nel light DOM).
  function queryAllDeep(root, selector) {
    const found = new Set();
    function traverse(node) {
      // Prima traversa il shadowRoot del nodo stesso
      if (node.shadowRoot) traverse(node.shadowRoot);
      try { Array.from(node.querySelectorAll(selector)).forEach(el => found.add(el)); } catch {}
      try {
        Array.from(node.querySelectorAll('*')).forEach(el => {
          if (el.shadowRoot) traverse(el.shadowRoot);
        });
      } catch {}
    }
    traverse(root || document);
    return Array.from(found);
  }

  // Trova il primo elemento che soddisfa il predicato attraverso shadow DOM
  function findDeep(root, predicate) {
    function traverse(node) {
      // Traversa prima il shadowRoot del nodo stesso
      if (node.shadowRoot) {
        const r = traverse(node.shadowRoot);
        if (r) return r;
      }
      const all = Array.from(node.querySelectorAll('*'));
      for (const el of all) {
        if (predicate(el)) return el;
      }
      for (const el of all) {
        if (el.shadowRoot) {
          const found = traverse(el.shadowRoot);
          if (found) return found;
        }
      }
      return null;
    }
    return traverse(root || document);
  }

  // Clicca un elemento: se è un Web Component cerca il button interno nel shadow root
  function clickEl(el) {
    if (!el) return;
    if (el.shadowRoot) {
      const inner = el.shadowRoot.querySelector('button, a, [role="button"]');
      if (inner) { inner.click(); return; }
    }
    el.click();
  }

  // Simula una sequenza realistica di eventi mouse (per Angular/custom components)
  function clickNative(el) {
    if (!el) return;
    const opts = { bubbles: true, cancelable: true, composed: true };
    el.dispatchEvent(new PointerEvent('pointerover',  opts));
    el.dispatchEvent(new MouseEvent ('mouseover',     opts));
    el.dispatchEvent(new PointerEvent('pointerenter', opts));
    el.dispatchEvent(new MouseEvent ('mouseenter',    opts));
    el.dispatchEvent(new PointerEvent('pointermove',  opts));
    el.dispatchEvent(new MouseEvent ('mousemove',     opts));
    el.dispatchEvent(new PointerEvent('pointerdown',  opts));
    el.dispatchEvent(new MouseEvent ('mousedown',     opts));
    el.dispatchEvent(new PointerEvent('pointerup',    opts));
    el.dispatchEvent(new MouseEvent ('mouseup',       opts));
    el.dispatchEvent(new MouseEvent ('click',         opts));
  }

  // Setter React/framework-aware
  function setNativeVal(el, value) {
    try {
      const proto = el.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value);
    } catch { el.value = value; }
    el.dispatchEvent(new Event('input',  { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  // ── Cerca bottone per testo o title (shadow DOM aware) ───────────────────────
  function findButtonByText(text, root = document) {
    // 1. ARU-BUTTON: il testo è nel title dell'inner button nel shadow root
    const aruBtns = Array.from(document.querySelectorAll('ARU-BUTTON'));
    const aruBtn = aruBtns.find(el => {
      if (!el.shadowRoot) return false;
      const inner = el.shadowRoot.querySelector('button');
      return inner?.title?.includes(text) ||
             inner?.textContent?.trim().includes(text) ||
             el.shadowRoot.innerHTML.includes(text);
    });
    if (aruBtn) return aruBtn;

    // 2. Elementi standard nel DOM principale (textContent o title)
    const sel = 'button, a, [role="button"]';
    const direct = Array.from((root.querySelectorAll ? root : document).querySelectorAll(sel))
      .find(b => (b.textContent.trim().includes(text) || b.title?.includes(text)) && !b.disabled);
    if (direct) return direct;

    // 3. Ricerca profonda attraverso tutti i shadow roots
    return findDeep(root, el => {
      const tag = el.tagName?.toLowerCase() || '';
      return (tag === 'button' || tag === 'a' || el.getAttribute('role') === 'button') &&
        (el.textContent.trim().includes(text) || el.title?.includes(text)) && !el.disabled;
    });
  }

  // ── Dialog detection (ARU-SHEET-MODAL) ───────────────────────────────────────
  function getDialog() {
    return (
      document.querySelector('ARU-SHEET-MODAL') ||
      document.querySelector('[role="dialog"]') ||
      document.querySelector('[aria-modal="true"]') ||
      null
    );
  }

  // ── Toggle helpers (shadow DOM aware) ────────────────────────────────────────
  function getToggleState(t) {
    if (t.type === 'checkbox') return t.checked;
    const ac = t.getAttribute('aria-checked');
    if (ac !== null) return ac === 'true';
    return t.classList.contains('active') || t.dataset.state === 'checked';
  }

  function findToggleByLabel(container, labelText) {
    // Usa ricerca globale nei shadow roots (stessa strategia di findShadowInputs)
    const candidates = [
      ...Array.from(document.querySelectorAll('*')).filter(el => el.shadowRoot)
        .flatMap(el => Array.from(el.shadowRoot.querySelectorAll('input[type="checkbox"], [role="switch"], button[aria-checked]'))),
    ];
    for (const t of candidates) {
      let el = t.parentElement;
      for (let i = 0; i < 6; i++) {
        if (!el) break;
        const txt = el.textContent.trim();
        if (txt.includes(labelText) && txt.length < labelText.length + 300) return t;
        el = el.parentElement;
      }
    }
    return null;
  }

  async function setToggle(container, labelText, wantOn) {
    const t = findToggleByLabel(container, labelText);
    if (!t) { console.warn(`[FTC HUB] toggle "${labelText}" non trovato`); return; }
    if (getToggleState(t) !== wantOn) { clickEl(t); await sleep(250); }
  }

  // ── Pannello flottante ────────────────────────────────────────────────────────
  function ensurePanel() {
    let p = document.getElementById('ftchub-panel');
    if (p) return p;
    p = document.createElement('div');
    p.id = 'ftchub-panel';
    Object.assign(p.style, {
      position: 'fixed', top: '68px', right: '16px', zIndex: '2147483647',
      background: '#1e3a5f', color: '#fff', borderRadius: '12px',
      padding: '12px 16px', fontFamily: 'system-ui, sans-serif', fontSize: '13px',
      boxShadow: '0 8px 32px rgba(0,0,0,0.4)', minWidth: '250px', maxWidth: '320px',
      display: 'flex', flexDirection: 'column', gap: '4px',
      userSelect: 'none', whiteSpace: 'pre-line',
    });
    p.innerHTML = `
      <div style="font-size:10px;font-weight:700;opacity:.45;text-transform:uppercase;letter-spacing:.8px">FTC HUB</div>
      <div id="ftchub-title" style="font-weight:700;font-size:14px;line-height:1.3"></div>
      <div id="ftchub-sub"   style="font-size:11px;opacity:.8;line-height:1.5"></div>
    `;
    document.body.appendChild(p);
    return p;
  }

  function setStatus(title, sub) {
    ensurePanel();
    document.getElementById('ftchub-title').textContent = title;
    document.getElementById('ftchub-sub').textContent   = sub || '';
  }

  // ── Rileva toast Aruba dopo "Crea casella" ────────────────────────────────────
  async function detectToast(timeout = 9000) {
    const matches = (text) =>
      text.includes('creata') || text.includes('alias') ||
      text.includes('autorisponditore') || text.includes('mailing');
    try {
      const el = await waitFor(() => {
        const candidates = [
          ...Array.from(document.querySelectorAll('[role="alert"],[role="status"]')),
          ...findTagDeep('ARU-TOAST'),
          ...findTagDeep('ARU-SNACKBAR'),
          ...findTagDeep('ARU-FEEDBACK'),
          ...Array.from(document.querySelectorAll('*'))
            .filter(e => e.shadowRoot)
            .flatMap(e => Array.from(e.shadowRoot.querySelectorAll('[role="alert"],[role="status"]'))),
        ];
        return candidates.find(e => matches(e.textContent.toLowerCase())) || null;
      }, timeout);
      const t = el.textContent.toLowerCase();
      if (t.includes('creata')) return 'created';
      if (t.includes('alias') || t.includes('autorisponditore') || t.includes('mailing')) return 'exists';
      return 'error';
    } catch { return 'unknown'; }
  }

  function saveResult(id, prefix, status) {
    const results = JSON.parse(sessionStorage.getItem(RESULTS_KEY) || '[]');
    results.push({ id, prefix, status });
    sessionStorage.setItem(RESULTS_KEY, JSON.stringify(results));
  }

  // Ricerca elementi per tagName ricorsivamente in tutti i shadow roots
  function findTagDeep(tagName) {
    const found = [];
    function traverse(root) {
      found.push(...Array.from(root.querySelectorAll(tagName)));
      Array.from(root.querySelectorAll('*')).forEach(el => {
        if (el.shadowRoot) traverse(el.shadowRoot);
      });
    }
    traverse(document);
    return found;
  }

  // Ricerca globale input nei shadow roots (approccio che funziona con Aruba)
  function findShadowInputs(typeSelector = 'input') {
    return Array.from(document.querySelectorAll('*'))
      .filter(el => el.shadowRoot)
      .flatMap(el => Array.from(el.shadowRoot.querySelectorAll(typeSelector)))
      .filter(i => i.offsetParent !== null && !i.readOnly);
  }

  // ── Step 1: Profilo ───────────────────────────────────────────────────────────
  async function fillProfilo(mailbox) {
    setStatus('Step 1/3 — Profilo', mailbox.prefix + '@flyingtigeritalia.com');

    await waitFor(getDialog, 8000);
    await sleep(1200);

    // Gli input sono in shadow roots di elementi nel light DOM del modal.
    // La ricerca globale nei shadow roots è l'unico approccio che funziona con Aruba.
    let inputs = [];
    for (let attempt = 0; attempt < 6 && inputs.length === 0; attempt++) {
      inputs = findShadowInputs('input[type="text"], input[type="email"], input:not([type])');
      if (inputs.length === 0) await sleep(400);
    }

    // Aruba vuole solo il prefix (senza @dominio) nel campo indirizzo casella
    if (inputs[0]) setNativeVal(inputs[0], mailbox.prefix);
    if (inputs[1]) setNativeVal(inputs[1], mailbox.name);

    // Antispam — ARU-INPUT-SELECT (Angular web component, nested in shadow DOM)
    await sleep(300);
    let antispamDone = false;

    // Trova ARU-INPUT-SELECT — non filtriamo per textContent perché "Nessuno"
    // è annidato in ARU-TEXT.shadowRoot e non affiora nel textContent del padre
    const allAruSelects = findTagDeep('ARU-INPUT-SELECT');
    const antispamTrigger = allAruSelects[0] || null;

    setStatus('Step 1/3 — Profilo', `antispam: ${allAruSelects.length} found, trigger: ${antispamTrigger ? 'OK' : 'NO'}`);
    await sleep(400);

    if (antispamTrigger) {
      // Il trigger reale è il DIV[role="combobox"] dentro il shadow root
      // Retry perché Angular potrebbe non aver ancora renderizzato il contenuto
      let combobox = null;
      for (let i = 0; i < 8 && !combobox; i++) {
        combobox = antispamTrigger.shadowRoot?.querySelector('[role="combobox"]') ||
                   antispamTrigger.shadowRoot?.querySelector('[tabindex="0"]') ||
                   antispamTrigger.shadowRoot?.querySelector('div');
        if (!combobox) await sleep(300);
      }
      setStatus('Step 1/3 — Profilo', `antispam: ${combobox ? combobox.tagName + '[' + (combobox.getAttribute('role') || '') + ']' : 'NO shadow content'}`);
      await sleep(300);

      if (combobox) {
        // Focus l'inner div (tabindex="0") e dispatch Space — è lui il vero target dei keyboard events
        combobox.focus();
        await sleep(400);
        combobox.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', code: 'Space', keyCode: 32, which: 32, bubbles: true, composed: true, cancelable: true }));
        combobox.dispatchEvent(new KeyboardEvent('keyup',   { key: ' ', code: 'Space', keyCode: 32, which: 32, bubbles: true, composed: true }));
        await sleep(900);

        // Cerca l'opzione Whitelisting Aruba (appare solo col dropdown aperto)
        let wlOption = null;
        for (let i = 0; i < 8 && !wlOption; i++) {
          wlOption = findTagDeep('ARU-TEXT')
            .find(el => el.shadowRoot?.textContent.toLowerCase().includes('whitelist'));
          if (!wlOption) await sleep(300);
        }

        if (wlOption) {
          setStatus('Step 1/3 — Profilo', 'antispam: Whitelisting click');
          const clickTarget = wlOption.getRootNode?.()?.host || wlOption;
          clickEl(clickTarget);
          antispamDone = true;
        } else {
          setStatus('Step 1/3 — Profilo', 'antispam: opzione non trovata, skip');
        }
      }
      await sleep(400);
    }

    await sleep(400);
    const procedi = findButtonByText('Procedi');
    if (!procedi) throw new Error('"Procedi" non trovato (step Profilo)');
    clickEl(procedi);
  }

  // ── Step 2: Password ──────────────────────────────────────────────────────────
  async function fillPassword() {
    setStatus('Step 2/3 — Password', '••••••••');

    await waitFor(getDialog, 6000);
    await sleep(400);

    const pwdInputs = findShadowInputs('input[type="password"]');

    if (pwdInputs[0]) setNativeVal(pwdInputs[0], PWD);
    if (pwdInputs[1]) setNativeVal(pwdInputs[1], PWD);

    await sleep(350);
    const procedi = findButtonByText('Procedi');
    if (!procedi) throw new Error('"Procedi" non trovato (step Password)');
    clickEl(procedi);
  }

  // ── Step 3: Configurazioni ────────────────────────────────────────────────────
  async function fillConfigurazioni() {
    setStatus('Step 3/3 — Configurazioni', 'Archivio OFF · Reimposta PWD OFF');

    const dialog = await waitFor(getDialog, 6000);
    await sleep(600);

    await setToggle(dialog, 'Archivio', false);
    await setToggle(dialog, 'Reimposta password al primo accesso', false);

    await sleep(350);
    const crea = findButtonByText('Crea casella');
    if (!crea) throw new Error('"Crea casella" non trovato');
    clickEl(crea);
  }

  // ── Processa una singola casella ──────────────────────────────────────────────
  async function processMailbox(mailbox, idx, total) {
    setStatus(`Casella ${idx + 1} / ${total}`, 'Ricerca pulsante…');

    const btnCrea = await waitFor(() => findButtonByText('Crea nuova casella'), 12000);
    clickEl(btnCrea);

    await waitFor(getDialog, 8000);
    await sleep(300);

    // Step 1 — Profilo
    await fillProfilo(mailbox);

    // Attendi step 2 (input password) — usa findShadowInputs come in fillPassword
    await waitFor(
      () => findShadowInputs('input[type="password"]')[0],
      10000
    );
    await sleep(200);

    // Step 2 — Password
    await fillPassword();

    // Attendi step 3 (pulsante "Crea casella")
    await waitFor(() => findButtonByText('Crea casella'), 10000);
    await sleep(200);

    // Step 3 — Configurazioni
    await fillConfigurazioni();

    // Rileva toast Aruba per determinare l'esito
    const toastStatus = await detectToast(9000);
    saveResult(mailbox.id || '', mailbox.prefix, toastStatus);

    const statusLabel = toastStatus === 'created'  ? '✅ Casella creata' :
                        toastStatus === 'exists'   ? '⚠️ Già esistente' : '❓ Esito sconosciuto';
    setStatus(`${idx + 1}/${total} — ${statusLabel}`, mailbox.prefix + '@flyingtigeritalia.com');

    // Se errore il dialog resta aperto — chiudiamo con Annulla
    if (toastStatus !== 'created') {
      await sleep(600);
      const annulla = findButtonByText('Annulla');
      if (annulla) { clickEl(annulla); await sleep(500); }
    }

    // Attendi ritorno alla lista (ricomparsa bottone "Crea nuova casella")
    await waitFor(() => findButtonByText('Crea nuova casella'), 20000);
    await sleep(800);
  }

  // ── Loop principale ───────────────────────────────────────────────────────────
  async function run() {
    const queue = getQueue();
    if (!queue.length) return;

    let idx = getIndex();
    if (idx >= queue.length) {
      setStatus('✅ Completato!', `Tutte le ${queue.length} caselle create`);
      return;
    }

    try {
      while (idx < queue.length) {
        await processMailbox(queue[idx], idx, queue.length);
        idx++;
        saveIndex(idx);
        await sleep(700);
      }
      setStatus('✅ Completato!', `Tutte le ${queue.length} caselle create`);
      const returnUrl = sessionStorage.getItem(R_KEY);
      if (returnUrl) {
        await sleep(2500);
        const results = JSON.parse(sessionStorage.getItem(RESULTS_KEY) || '[]');
        const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(results))));
        const sep = returnUrl.includes('?') ? '&' : '?';
        window.location.href = `${returnUrl}${sep}aruba=${encoded}`;
      }
    } catch (e) {
      setStatus('❌ Errore', e.message);
      console.error('[FTC HUB Aruba]', e);
    }
  }

  setTimeout(run, 3000);
})();
