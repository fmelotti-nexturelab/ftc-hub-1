const DB_NAME = "ftchub_settings"
const STORE_NAME = "folder_handles"

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = (e) => e.target.result.createObjectStore(STORE_NAME)
    req.onsuccess = (e) => resolve(e.target.result)
    req.onerror = reject
  })
}

export async function saveFolderHandle(key, handle) {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite")
    tx.objectStore(STORE_NAME).put(handle, key)
    tx.oncomplete = resolve
    tx.onerror = reject
  })
}

export async function getFolderHandle(key) {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly")
    const req = tx.objectStore(STORE_NAME).get(key)
    req.onsuccess = () => resolve(req.result ?? null)
    req.onerror = reject
  })
}

export async function removeFolderHandle(key) {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite")
    tx.objectStore(STORE_NAME).delete(key)
    tx.oncomplete = resolve
    tx.onerror = reject
  })
}
