import { useState, useEffect, useRef, useCallback } from 'react'
import { dehydrateImageRefs, resolveImageRefs, revokeAllUrls, getAllImageIds, deleteImage } from '../utils/imageStore.js'

const DOCS_KEY = 'markdown-editor-docs'
const CURRENT_KEY = 'markdown-editor-current'
const DOC_PREFIX = 'markdown-editor-doc-'
const OLD_KEY = 'markdown-editor-content'
const SAVE_DELAY = 1000

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
}

function loadDocs() {
  try {
    const raw = localStorage.getItem(DOCS_KEY)
    if (raw) return JSON.parse(raw)
  } catch { /* ignore */ }
  return null
}

function saveDocs(docs) {
  localStorage.setItem(DOCS_KEY, JSON.stringify(docs))
}

function loadDocContent(id) {
  try {
    const raw = localStorage.getItem(DOC_PREFIX + id)
    if (raw) return JSON.parse(raw)
  } catch { /* ignore */ }
  return null
}

function saveDocContent(id, json) {
  localStorage.setItem(DOC_PREFIX + id, JSON.stringify(json))
}

// Check if a name already exists among siblings (same parentId), optionally excluding an item by id
function hasDuplicateName(docs, name, parentId, excludeId = null) {
  return docs.some(
    (d) =>
      d.parentId === parentId &&
      d.id !== excludeId &&
      d.name.localeCompare(name, undefined, { sensitivity: 'base' }) === 0
  )
}

// Generate a unique name by appending " (2)", " (3)", etc. if needed
function uniqueName(docs, baseName, parentId) {
  if (!hasDuplicateName(docs, baseName, parentId)) return baseName
  let i = 2
  while (hasDuplicateName(docs, `${baseName} (${i})`, parentId)) i++
  return `${baseName} (${i})`
}

function createBlankItem(name = 'Untitled', type = 'doc', parentId = null) {
  return {
    id: generateId(),
    name,
    type,
    parentId,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
}

// Migrate flat docs to tree model (add type + parentId if missing)
function migrateToTree(docs) {
  if (!docs || docs.length === 0) return docs
  if (docs[0].type) return docs // already migrated
  return docs.map((d) => ({ ...d, type: 'doc', parentId: null }))
}

function migrate() {
  // Already migrated
  if (localStorage.getItem(DOCS_KEY)) return null

  const oldContent = localStorage.getItem(OLD_KEY)
  if (oldContent) {
    let content = null
    try {
      content = JSON.parse(oldContent)
    } catch { /* ignore */ }

    const doc = createBlankItem('Untitled', 'doc', null)
    const docs = [doc]
    saveDocs(docs)
    if (content) {
      saveDocContent(doc.id, content)
    }
    localStorage.setItem(CURRENT_KEY, doc.id)
    localStorage.removeItem(OLD_KEY)
    return { docs, currentDocId: doc.id }
  }

  return null
}

function initState() {
  // Try migration first
  const migrated = migrate()
  if (migrated) return migrated

  // Load existing docs
  let docs = loadDocs()
  if (docs && docs.length > 0) {
    // Migrate to tree model if needed
    const migrateDocs = migrateToTree(docs)
    if (migrateDocs !== docs) {
      saveDocs(migrateDocs)
      docs = migrateDocs
    }
    let currentDocId = localStorage.getItem(CURRENT_KEY)
    if (!currentDocId || !docs.find((d) => d.id === currentDocId)) {
      currentDocId = docs.find((d) => d.type === 'doc')?.id || docs[0].id
    }
    return { docs, currentDocId }
  }

  // Fresh start
  const doc = createBlankItem('Untitled', 'doc', null)
  saveDocs([doc])
  localStorage.setItem(CURRENT_KEY, doc.id)
  return { docs: [doc], currentDocId: doc.id }
}

// Collect all descendant IDs recursively
function collectDescendants(docs, id) {
  const children = docs.filter((d) => d.parentId === id)
  let ids = []
  for (const child of children) {
    ids.push(child.id)
    ids = ids.concat(collectDescendants(docs, child.id))
  }
  return ids
}

// Collect all img://{id} references from all stored docs
function collectImageRefs(docs) {
  const refs = new Set()
  for (const doc of docs) {
    if (doc.type !== 'doc') continue
    const content = loadDocContent(doc.id)
    if (!content) continue
    const json = JSON.stringify(content)
    const matches = json.matchAll(/"img:\/\/([^"]+)"/g)
    for (const m of matches) refs.add(m[1])
  }
  return refs
}

// Remove images from IndexedDB that are not referenced by any document
async function cleanupOrphanImages(docs) {
  try {
    const usedIds = collectImageRefs(docs)
    const allIds = await getAllImageIds()
    for (const id of allIds) {
      if (!usedIds.has(id)) await deleteImage(id)
    }
  } catch { /* ignore cleanup errors */ }
}

export default function useDocuments(editor) {
  const [state, setState] = useState(initState)
  const [lastSaved, setLastSaved] = useState(null)
  const timerRef = useRef(null)
  const editorRef = useRef(editor)
  const stateRef = useRef(state)

  editorRef.current = editor
  stateRef.current = state

  // Flush: save current editor content immediately
  const flush = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    const ed = editorRef.current
    const { currentDocId, docs } = stateRef.current
    if (!ed || !currentDocId) return
    const json = dehydrateImageRefs(ed.getJSON())
    saveDocContent(currentDocId, json)
    // Update updatedAt
    const updatedDocs = docs.map((d) =>
      d.id === currentDocId ? { ...d, updatedAt: Date.now() } : d
    )
    saveDocs(updatedDocs)
    setLastSaved(new Date())
    setState((s) => ({ ...s, docs: updatedDocs }))
  }, [])

  // Load content into editor for a given doc id
  const loadIntoEditor = useCallback(async (id) => {
    const ed = editorRef.current
    if (!ed) return
    const raw = loadDocContent(id)
    const content = raw ? await resolveImageRefs(raw) : null
    ed.commands.setContent(content || { type: 'doc', content: [{ type: 'paragraph' }] })
  }, [])

  // Initialize editor content on first editor ready
  useEffect(() => {
    if (!editor) return
    loadIntoEditor(state.currentDocId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor])

  // Auto-save on editor update (debounced)
  useEffect(() => {
    if (!editor) return

    const handleUpdate = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }
      timerRef.current = setTimeout(() => {
        timerRef.current = null
        flush()
      }, SAVE_DELAY)
    }

    editor.on('update', handleUpdate)
    return () => {
      editor.off('update', handleUpdate)
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }
  }, [editor, flush])

  // beforeunload — save on browser close
  useEffect(() => {
    const handleBeforeUnload = () => flush()
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [flush])

  const switchDoc = useCallback((id) => {
    if (id === stateRef.current.currentDocId) return
    flush()
    revokeAllUrls()
    setState((s) => ({ ...s, currentDocId: id }))
    localStorage.setItem(CURRENT_KEY, id)
    loadIntoEditor(id)
  }, [flush, loadIntoEditor])

  const createDoc = useCallback((parentId = null) => {
    flush()
    const { docs } = stateRef.current
    const name = uniqueName(docs, 'Untitled', parentId)
    const doc = createBlankItem(name, 'doc', parentId)
    setState((s) => {
      const newDocs = [...s.docs, doc]
      saveDocs(newDocs)
      localStorage.setItem(CURRENT_KEY, doc.id)
      return { docs: newDocs, currentDocId: doc.id }
    })
    // Clear editor for new doc
    const ed = editorRef.current
    if (ed) {
      ed.commands.setContent({ type: 'doc', content: [{ type: 'paragraph' }] })
    }
    return doc.id
  }, [flush])

  const createFolder = useCallback((parentId = null) => {
    const { docs } = stateRef.current
    const name = uniqueName(docs, 'New Folder', parentId)
    const folder = createBlankItem(name, 'folder', parentId)
    setState((s) => {
      const newDocs = [...s.docs, folder]
      saveDocs(newDocs)
      return { ...s, docs: newDocs }
    })
    return folder.id
  }, [])

  const deleteItem = useCallback((id) => {
    const { docs, currentDocId } = stateRef.current

    // Collect all IDs to delete (item + descendants)
    const descendantIds = collectDescendants(docs, id)
    const allDeleteIds = new Set([id, ...descendantIds])

    // Check: at least 1 doc must remain after deletion
    const remainingDocs = docs.filter((d) => !allDeleteIds.has(d.id) && d.type === 'doc')
    if (remainingDocs.length === 0) return

    // Confirm if deleting multiple items
    if (allDeleteIds.size > 1) {
      if (!window.confirm(`Delete this item and its ${allDeleteIds.size - 1} child item(s)?`)) return
    }

    flush()

    // Remove content for all docs being deleted
    for (const delId of allDeleteIds) {
      const item = docs.find((d) => d.id === delId)
      if (item && item.type === 'doc') {
        localStorage.removeItem(DOC_PREFIX + delId)
      }
    }

    const newDocs = docs.filter((d) => !allDeleteIds.has(d.id))
    saveDocs(newDocs)

    let newCurrentId = currentDocId
    if (allDeleteIds.has(currentDocId)) {
      newCurrentId = remainingDocs[0].id
      localStorage.setItem(CURRENT_KEY, newCurrentId)
      loadIntoEditor(newCurrentId)
    }

    setState({ docs: newDocs, currentDocId: newCurrentId })

    // Async: clean up orphan images in IndexedDB
    cleanupOrphanImages(newDocs)
  }, [flush, loadIntoEditor])

  const moveItem = useCallback((id, newParentId) => {
    const { docs } = stateRef.current
    const item = docs.find((d) => d.id === id)
    if (!item) return
    if (item.parentId === newParentId) return
    // Prevent moving into itself or its own descendants
    if (newParentId === id) return
    const descendants = new Set(collectDescendants(docs, id))
    if (newParentId && descendants.has(newParentId)) return
    // Prevent duplicate names in the target folder
    if (hasDuplicateName(docs, item.name, newParentId, id)) {
      const targetName = newParentId
        ? docs.find((d) => d.id === newParentId)?.name || 'target folder'
        : 'root'
      alert(`"${item.name}" already exists in ${targetName}. Please rename it first.`)
      return
    }

    setState((s) => {
      const newDocs = s.docs.map((d) =>
        d.id === id ? { ...d, parentId: newParentId, updatedAt: Date.now() } : d
      )
      saveDocs(newDocs)
      return { ...s, docs: newDocs }
    })
  }, [])

  const renameDoc = useCallback((id, name) => {
    const trimmed = name.trim()
    if (!trimmed) return // reject empty name
    const { docs } = stateRef.current
    const item = docs.find((d) => d.id === id)
    if (!item) return
    if (hasDuplicateName(docs, trimmed, item.parentId, id)) {
      alert(`"${trimmed}" already exists in this location. Please use a different name.`)
      return
    }
    setState((s) => {
      const newDocs = s.docs.map((d) =>
        d.id === id ? { ...d, name: trimmed, updatedAt: Date.now() } : d
      )
      saveDocs(newDocs)
      return { ...s, docs: newDocs }
    })
  }, [])

  const closeTab = useCallback((id) => {
    const { docs, currentDocId } = stateRef.current
    const openDocs = docs.filter((d) => d.type === 'doc')
    if (openDocs.length <= 1) return

    if (id === currentDocId) {
      const idx = openDocs.findIndex((d) => d.id === id)
      const next = openDocs[idx + 1] || openDocs[idx - 1]
      if (next) switchDoc(next.id)
    }
  }, [switchDoc])

  const currentDoc = state.docs.find((d) => d.id === state.currentDocId) || state.docs[0]

  return {
    docs: state.docs,
    currentDocId: state.currentDocId,
    currentDocName: currentDoc?.name || 'Untitled',
    lastSaved,
    switchDoc,
    createDoc,
    createFolder,
    deleteItem,
    closeTab,
    moveItem,
    renameDoc,
  }
}
