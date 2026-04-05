// Persistenza locale (IndexedDB via idb-keyval) dei dati transitori della
// pagina CheckPrezzi che NON vanno sul backend (troppo grandi o specifici
// del dispositivo dell'utente):
//   - ITEM  (anagrafe articoli NAV, ~70k righe, fino a ~15 MB testo)
//   - PRICE (listino prezzi NAV, dimensioni simili)
//
// localStorage esplode oltre 5-10 MB: IndexedDB regge GB senza problemi.
// Le chiavi sono scopate per entity: IT01 / IT02 / IT03.
//
// La "Lista Cambi Prezzi" NON e' qui: vive sul backend (tabella ho.check_prezzi_lista).
//
// Formato salvato: { text: string, savedAt: string ISO, savedBy: string | null }
// Retrocompatibilita': se il valore e' una stringa nuda (vecchio formato),
// lo interpreto come text con savedAt=null e savedBy=null.

import { get, set, del } from "idb-keyval"

function keyItem(entity)  { return `check_prezzi_${entity}_item` }
function keyPrice(entity) { return `check_prezzi_${entity}_price` }

function normalizeEntry(raw) {
  if (raw == null) return { text: "", savedAt: null, savedBy: null }
  if (typeof raw === "string") return { text: raw, savedAt: null, savedBy: null }
  if (typeof raw === "object" && typeof raw.text === "string") {
    return {
      text: raw.text,
      savedAt: raw.savedAt ?? null,
      savedBy: raw.savedBy ?? null,
    }
  }
  return { text: "", savedAt: null, savedBy: null }
}

export async function loadItem(entity) {
  return normalizeEntry(await get(keyItem(entity)))
}

export async function saveItem(entity, text, savedBy = null) {
  if (!text) {
    await del(keyItem(entity))
    return { text: "", savedAt: null, savedBy: null }
  }
  const entry = { text, savedAt: new Date().toISOString(), savedBy }
  await set(keyItem(entity), entry)
  return entry
}

export async function loadPrice(entity) {
  return normalizeEntry(await get(keyPrice(entity)))
}

export async function savePrice(entity, text, savedBy = null) {
  if (!text) {
    await del(keyPrice(entity))
    return { text: "", savedAt: null, savedBy: null }
  }
  const entry = { text, savedAt: new Date().toISOString(), savedBy }
  await set(keyPrice(entity), entry)
  return entry
}

export async function clearEntityCache(entity) {
  await Promise.all([del(keyItem(entity)), del(keyPrice(entity))])
}

// ── Legacy wrappers (retrocompatibilita' per chiamanti vecchi) ───────────────
export async function loadItemText(entity)  { return (await loadItem(entity)).text }
export async function loadPriceText(entity) { return (await loadPrice(entity)).text }
export async function saveItemText(entity, text)  { await saveItem(entity, text) }
export async function savePriceText(entity, text) { await savePrice(entity, text) }
