const DB_NAME = 'markdown-editor-images'
const STORE_NAME = 'images'
const DB_VERSION = 1

let dbPromise = null

function openDB() {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
  return dbPromise
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
}

// In-memory cache: imageId -> blobUrl
const urlCache = new Map()
// Reverse lookup: blobUrl -> imageId
const reverseCache = new Map()

export async function saveImage(blob) {
  const id = generateId()
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).put(blob, id)
    tx.oncomplete = () => resolve(id)
    tx.onerror = () => reject(tx.error)
  })
}

export async function getImage(id) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const request = tx.objectStore(STORE_NAME).get(id)
    request.onsuccess = () => resolve(request.result || null)
    request.onerror = () => reject(request.error)
  })
}

export async function deleteImage(id) {
  // Revoke cached URL if present
  const url = urlCache.get(id)
  if (url) {
    URL.revokeObjectURL(url)
    reverseCache.delete(url)
    urlCache.delete(id)
  }
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).delete(id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function getImageUrl(id) {
  if (urlCache.has(id)) return urlCache.get(id)
  const blob = await getImage(id)
  if (!blob) return null
  const url = URL.createObjectURL(blob)
  urlCache.set(id, url)
  reverseCache.set(url, id)
  return url
}

export function revokeAllUrls() {
  for (const url of urlCache.values()) {
    URL.revokeObjectURL(url)
  }
  urlCache.clear()
  reverseCache.clear()
}

// Get all image IDs stored in IndexedDB
export async function getAllImageIds() {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const request = tx.objectStore(STORE_NAME).getAllKeys()
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

// Async: replace img://{id} refs in TipTap JSON with blob URLs
export async function resolveImageRefs(json) {
  if (!json) return json
  if (typeof json === 'string') return json

  if (Array.isArray(json)) {
    return Promise.all(json.map((item) => resolveImageRefs(item)))
  }

  if (typeof json === 'object') {
    const result = {}
    for (const key of Object.keys(json)) {
      if (key === 'src' && typeof json[key] === 'string' && json[key].startsWith('img://')) {
        const id = json[key].slice(6)
        const url = await getImageUrl(id)
        result[key] = url || json[key]
      } else {
        result[key] = await resolveImageRefs(json[key])
      }
    }
    return result
  }

  return json
}

// Sync: replace blob: URLs with img://{id} refs in TipTap JSON
export function dehydrateImageRefs(json) {
  if (!json) return json
  if (typeof json === 'string') return json

  if (Array.isArray(json)) {
    return json.map((item) => dehydrateImageRefs(item))
  }

  if (typeof json === 'object') {
    const result = {}
    for (const key of Object.keys(json)) {
      if (key === 'src' && typeof json[key] === 'string' && json[key].startsWith('blob:')) {
        const id = reverseCache.get(json[key])
        result[key] = id ? `img://${id}` : json[key]
      } else {
        result[key] = dehydrateImageRefs(json[key])
      }
    }
    return result
  }

  return json
}
