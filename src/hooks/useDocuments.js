import { useState, useEffect, useRef, useCallback } from 'react'
import { dehydrateImageRefs, resolveImageRefs, revokeAllUrls, getAllImageIds, deleteImage, saveImage, getImageUrl } from '../utils/imageStore.js'
import { editorToMarkdown, markdownToHtml } from '../utils/markdown.js'
import {
  isTauri,
  moveFile,
  onAppClose,
  openDirectoryDialog,
  openTextFileDialog,
  readBinaryFile,
  readTextFile,
  saveTextFile,
  scanDirectory,
  watchDirectory,
  watchFile,
  writeTextFile,
} from '../utils/tauriAdapter'

const DOCS_KEY = 'markdown-editor-docs'
const CURRENT_KEY = 'markdown-editor-current'
const DOC_PREFIX = 'markdown-editor-doc-'
const OLD_KEY = 'markdown-editor-content'
const SAVE_DELAY = 1000
const MAX_VISIBLE_TABS = 8

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
}

function loadLocalDocs() {
  try {
    const raw = localStorage.getItem(DOCS_KEY)
    if (!raw) return null
    const docs = JSON.parse(raw)
    return docs.map((doc) => ({
      ...doc,
      source: 'local',
    }))
  } catch {
    return null
  }
}

function saveLocalDocs(docs) {
  localStorage.setItem(
    DOCS_KEY,
    JSON.stringify(
      docs.map(({ source, path, ...doc }) => doc)
    )
  )
}

function loadDocContent(id) {
  try {
    const raw = localStorage.getItem(DOC_PREFIX + id)
    if (raw) return JSON.parse(raw)
  } catch {
    // ignore
  }
  return null
}

function saveDocContent(id, json) {
  localStorage.setItem(DOC_PREFIX + id, JSON.stringify(json))
}

function fileNameFromPath(path) {
  return path?.split(/[/\\]/).pop() || 'Untitled'
}

function hasDuplicateName(docs, name, parentId, excludeId = null) {
  return docs.some(
    (d) =>
      d.parentId === parentId &&
      d.id !== excludeId &&
      d.name.localeCompare(name, undefined, { sensitivity: 'base' }) === 0
  )
}

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
    source: 'local',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
}

function createFileDoc(path, id = generateId()) {
  return {
    id,
    name: fileNameFromPath(path),
    type: 'doc',
    parentId: null,
    source: 'file',
    path,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
}

function migrateToTree(docs) {
  if (!docs || docs.length === 0) return docs
  if (docs[0].type && docs[0].source) return docs
  return docs.map((d) => ({
    ...d,
    type: d.type || 'doc',
    parentId: d.parentId ?? null,
    source: 'local',
  }))
}

function migrate() {
  if (localStorage.getItem(DOCS_KEY)) return null

  const oldContent = localStorage.getItem(OLD_KEY)
  if (!oldContent) return null

  let content = null
  try {
    content = JSON.parse(oldContent)
  } catch {
    // ignore
  }

  const doc = createBlankItem('Untitled', 'doc', null)
  const docs = [doc]
  saveLocalDocs(docs)
  if (content) {
    saveDocContent(doc.id, content)
  }
  localStorage.setItem(CURRENT_KEY, doc.id)
  localStorage.removeItem(OLD_KEY)
  return { localDocs: docs, currentDocId: doc.id }
}

function initState(hashDocId) {
  const migrated = migrate()
  if (migrated) {
    if (hashDocId && migrated.localDocs.find((d) => d.id === hashDocId && d.type === 'doc')) {
      migrated.currentDocId = hashDocId
      localStorage.setItem(CURRENT_KEY, hashDocId)
    }
    return {
      ...migrated,
      fileDocs: [],
      workspaceItems: [],
      workspaceRoot: null,
      recentDocIds: [migrated.currentDocId],
    }
  }

  let localDocs = loadLocalDocs()
  if (localDocs && localDocs.length > 0) {
    const migratedDocs = migrateToTree(localDocs)
    if (migratedDocs !== localDocs) {
      saveLocalDocs(migratedDocs)
      localDocs = migratedDocs
    }
    let currentDocId
    if (hashDocId && localDocs.find((d) => d.id === hashDocId && d.type === 'doc')) {
      currentDocId = hashDocId
    } else {
      currentDocId = localStorage.getItem(CURRENT_KEY)
      if (!currentDocId || !localDocs.find((d) => d.id === currentDocId)) {
        currentDocId = localDocs.find((d) => d.type === 'doc')?.id || localDocs[0].id
      }
    }
    return {
      localDocs,
      fileDocs: [],
      workspaceItems: [],
      workspaceRoot: null,
      currentDocId,
      recentDocIds: buildRecentDocIds([...localDocs], currentDocId),
    }
  }

  const doc = createBlankItem('Untitled', 'doc', null)
  saveLocalDocs([doc])
  localStorage.setItem(CURRENT_KEY, doc.id)
  return {
    localDocs: [doc],
    fileDocs: [],
    workspaceItems: [],
    workspaceRoot: null,
    currentDocId: doc.id,
    recentDocIds: [doc.id],
  }
}

function buildRecentDocIds(docs, currentDocId, existingIds = []) {
  const docIds = docs.filter((doc) => doc.type === 'doc').map((doc) => doc.id)
  const validExisting = existingIds.filter((id) => docIds.includes(id) && id !== currentDocId)
  const remaining = docIds.filter((id) => id !== currentDocId && !validExisting.includes(id))
  return [currentDocId, ...validExisting, ...remaining].filter(Boolean)
}

function touchRecentDocIds(recentDocIds, docId) {
  if (recentDocIds.includes(docId)) return recentDocIds
  return [...recentDocIds, docId]
}

function collectDescendants(docs, id) {
  const children = docs.filter((d) => d.parentId === id)
  let ids = []
  for (const child of children) {
    ids.push(child.id)
    ids = ids.concat(collectDescendants(docs, child.id))
  }
  return ids
}

function collectImageRefs(docs) {
  const refs = new Set()
  for (const doc of docs) {
    if (doc.type !== 'doc' || doc.source !== 'local') continue
    const content = loadDocContent(doc.id)
    if (!content) continue
    const json = JSON.stringify(content)
    const matches = json.matchAll(/"img:\/\/([^"]+)"/g)
    for (const match of matches) refs.add(match[1])
  }
  return refs
}

async function cleanupOrphanImages(docs) {
  try {
    const usedIds = collectImageRefs(docs)
    const allIds = await getAllImageIds()
    for (const id of allIds) {
      if (!usedIds.has(id)) await deleteImage(id)
    }
  } catch {
    // ignore cleanup errors
  }
}

function dirname(path) {
  const i = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'))
  return i >= 0 ? path.slice(0, i) : '.'
}

function isRemoteUrl(src) {
  return /^(https?:|blob:|data:|img:)/i.test(src)
}

async function resolveLocalImages(editor, docPath) {
  if (!editor || !docPath || !isTauri()) return
  const dir = dirname(docPath)
  const updates = []

  editor.state.doc.descendants((node, pos) => {
    if (node.type.name !== 'image') return
    const src = node.attrs.src
    if (!src || isRemoteUrl(src)) return
    updates.push({ pos, src })
  })

  if (updates.length === 0) return

  for (const { pos, src } of updates) {
    const absolute = src.startsWith('/') || /^[A-Z]:\\/i.test(src)
      ? src
      : dir + '/' + src.replace(/^\.\//, '')
    const base64 = await readBinaryFile(absolute)
    if (!base64) continue

    const ext = absolute.split('.').pop()?.toLowerCase() || 'png'
    const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg'
      : ext === 'gif' ? 'image/gif'
      : ext === 'webp' ? 'image/webp'
      : ext === 'svg' ? 'image/svg+xml'
      : 'image/png'

    const binary = atob(base64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    const blob = new Blob([bytes], { type: mime })

    const imageId = await saveImage(blob)
    const blobUrl = await getImageUrl(imageId)

    const { tr } = editor.state
    const currentNode = tr.doc.nodeAt(pos)
    if (currentNode?.type.name === 'image') {
      tr.setNodeMarkup(pos, undefined, {
        ...currentNode.attrs,
        src: blobUrl,
        'data-image-id': imageId,
        'data-original-src': src,
      })
      editor.view.dispatch(tr)
    }
  }
}

export default function useDocuments(editor, { hashDocId, setHash, replaceHash } = {}) {
  const [state, setState] = useState(() => initState(hashDocId))
  const [lastSaved, setLastSaved] = useState(null)
  const timerRef = useRef(null)
  const selfWriteRef = useRef(false)
  const editorRef = useRef(editor)
  const stateRef = useRef(state)

  editorRef.current = editor
  stateRef.current = state

  const getAllDocs = useCallback(
    (nextState = stateRef.current) => [...nextState.localDocs, ...nextState.fileDocs],
    []
  )

  const getDocById = useCallback(
    (id, nextState = stateRef.current) => getAllDocs(nextState).find((doc) => doc.id === id),
    [getAllDocs]
  )

  const loadIntoEditor = useCallback(async (id) => {
    const ed = editorRef.current
    const doc = getDocById(id)
    if (!ed || !doc) return
    if (doc.deleted) return

    if (doc.source === 'file') {
      const text = await readTextFile(doc.path)
      ed.commands.setContent(markdownToHtml(text || ''))
      await resolveLocalImages(ed, doc.path)
      return
    }

    const raw = loadDocContent(id)
    const content = raw ? await resolveImageRefs(raw) : null
    ed.commands.setContent(content || { type: 'doc', content: [{ type: 'paragraph' }] })
  }, [getDocById])

  const flush = useCallback(async () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }

    const ed = editorRef.current
    const { currentDocId, localDocs, fileDocs } = stateRef.current
    const doc = [...localDocs, ...fileDocs].find((item) => item.id === currentDocId)
    if (!ed || !doc) return

    if (doc.source === 'file' && doc.deleted) return

    if (doc.source === 'file') {
      const markdown = editorToMarkdown(ed)
      selfWriteRef.current = true
      await writeTextFile(doc.path, markdown)
      setTimeout(() => { selfWriteRef.current = false }, 1500)
      setLastSaved(new Date())
      setState((s) => ({
        ...s,
        fileDocs: s.fileDocs.map((item) =>
          item.id === doc.id ? { ...item, updatedAt: Date.now(), name: fileNameFromPath(doc.path) } : item
        ),
      }))
      return
    }

    const json = dehydrateImageRefs(ed.getJSON())
    saveDocContent(currentDocId, json)
    const updatedLocalDocs = localDocs.map((item) =>
      item.id === currentDocId ? { ...item, updatedAt: Date.now() } : item
    )
    saveLocalDocs(updatedLocalDocs)
    setLastSaved(new Date())
    setState((s) => ({ ...s, localDocs: updatedLocalDocs }))
  }, [])

  const switchDoc = useCallback(async (id, { pushHistory = true } = {}) => {
    if (id === stateRef.current.currentDocId) return
    await flush()
    revokeAllUrls()
    setState((s) => ({
      ...s,
      currentDocId: id,
      recentDocIds: touchRecentDocIds(s.recentDocIds, id),
    }))
    localStorage.setItem(CURRENT_KEY, id)
    await loadIntoEditor(id)
    if (pushHistory && setHash) setHash(id)
  }, [flush, loadIntoEditor, setHash])

  useEffect(() => {
    if (!editor) return
    void loadIntoEditor(state.currentDocId)
    if (replaceHash) replaceHash(state.currentDocId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor])

  useEffect(() => {
    if (!hashDocId) return
    const { currentDocId } = stateRef.current
    if (hashDocId === currentDocId) return
    if (getDocById(hashDocId)) {
      void switchDoc(hashDocId, { pushHistory: false })
    }
  }, [getDocById, hashDocId, switchDoc])

  useEffect(() => {
    if (!editor) return

    const handleUpdate = () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => {
        timerRef.current = null
        void flush()
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

  useEffect(() => onAppClose(() => { void flush() }), [flush])

  // Watch the current file for external changes and reload automatically
  useEffect(() => {
    if (!editor) return
    const doc = getDocById(state.currentDocId)
    if (!doc || doc.source !== 'file' || !doc.path) return

    let cancelled = false
    let unwatchFn = null

    watchFile(doc.path, async () => {
      if (cancelled) return
      if (selfWriteRef.current) return
      const ed = editorRef.current
      if (!ed) return
      if (ed.isFocused) return
      try {
        const text = await readTextFile(doc.path)
        if (cancelled) return
        ed.commands.setContent(markdownToHtml(text || ''))
      } catch {
        // ignore read errors during reload
      }
    }).then((fn) => {
      if (cancelled) {
        fn()
      } else {
        unwatchFn = fn
      }
    })

    return () => {
      cancelled = true
      if (unwatchFn) unwatchFn()
    }
  }, [editor, state.currentDocId, getDocById])

  // Watch workspace directory for structural changes (file create/delete)
  useEffect(() => {
    const { workspaceRoot } = stateRef.current
    if (!workspaceRoot) return

    let cancelled = false
    let unwatchFn = null

    watchDirectory(workspaceRoot, async () => {
      if (cancelled) return
      try {
        const entries = await scanDirectory(workspaceRoot)
        if (cancelled) return
        const nextWorkspaceItems = entries.map((entry) => ({
          id: entry.id,
          name: entry.name,
          type: entry.entryType,
          parentId: entry.parentId,
          path: entry.path,
          source: 'workspace',
        }))

        const workspacePaths = new Set(
          nextWorkspaceItems.filter((i) => i.type === 'doc').map((i) => i.path)
        )

        setState((s) => {
          const nextFileDocs = s.fileDocs.map((fd) => {
            if (fd.source !== 'file' || !fd.path) return fd
            const isUnderWorkspace = fd.path.startsWith(workspaceRoot + '/')
              || fd.path.startsWith(workspaceRoot + '\\')
            if (!isUnderWorkspace) return fd

            const shouldBeDeleted = !workspacePaths.has(fd.path)
            if (fd.deleted === shouldBeDeleted) return fd
            return { ...fd, deleted: shouldBeDeleted || undefined }
          })
          // Clean up: remove the `deleted` key entirely when false/undefined
          const cleanedFileDocs = nextFileDocs.map((fd) => {
            if (fd.deleted) return fd
            if ('deleted' in fd) {
              const { deleted, ...rest } = fd
              return rest
            }
            return fd
          })
          return { ...s, workspaceItems: nextWorkspaceItems, fileDocs: cleanedFileDocs }
        })
      } catch {
        // ignore scan errors
      }
    }).then((fn) => {
      if (cancelled) {
        fn()
      } else {
        unwatchFn = fn
      }
    })

    return () => {
      cancelled = true
      if (unwatchFn) unwatchFn()
    }
  }, [state.workspaceRoot])

  const openFile = useCallback(async (file) => {
    if (!file) return null

    await flush()

    if (!file.path) {
      const { localDocs } = stateRef.current
      const doc = createBlankItem(uniqueName(localDocs, file.name || 'Imported', null), 'doc', null)
      setState((s) => ({
        ...s,
        localDocs: [...s.localDocs, doc],
        currentDocId: doc.id,
        recentDocIds: touchRecentDocIds(s.recentDocIds, doc.id),
      }))
      saveLocalDocs([...stateRef.current.localDocs, doc])
      localStorage.setItem(CURRENT_KEY, doc.id)
      const ed = editorRef.current
      if (ed) ed.commands.setContent(markdownToHtml(file.content || ''))
      if (setHash) setHash(doc.id)
      return doc.id
    }

    const existing = stateRef.current.fileDocs.find((doc) => doc.path === file.path)
    if (existing) {
      await switchDoc(existing.id)
      return existing.id
    }

    const doc = createFileDoc(file.path)
    setState((s) => ({
      ...s,
      fileDocs: [...s.fileDocs, doc],
      currentDocId: doc.id,
      recentDocIds: touchRecentDocIds(s.recentDocIds, doc.id),
    }))
    localStorage.setItem(CURRENT_KEY, doc.id)
    const ed = editorRef.current
    if (ed) {
      ed.commands.setContent(markdownToHtml(file.content || ''))
      await resolveLocalImages(ed, file.path)
    }
    if (setHash) setHash(doc.id)
    return doc.id
  }, [flush, setHash, switchDoc])

  const openFileDialog = useCallback(async () => {
    const file = await openTextFileDialog()
    if (!file) return
    try {
      await openFile(file)
    } catch (error) {
      window.alert(`Failed to open file: ${error.message}`)
    }
  }, [openFile])

  const createNewFile = useCallback(async () => {
    const savedPath = await saveTextFile('', 'Untitled.md', 'text/markdown')
    if (!savedPath) return
    try {
      await openFile({ path: savedPath, name: fileNameFromPath(savedPath), content: '' })
    } catch (error) {
      window.alert(`Failed to create file: ${error.message}`)
    }
  }, [openFile])

  const openDirectory = useCallback(async () => {
    const dirPath = await openDirectoryDialog()
    if (!dirPath) return

    try {
      const entries = await scanDirectory(dirPath)
      const workspaceItems = entries.map((entry) => ({
        id: entry.id,
        name: entry.name,
        type: entry.entryType,
        parentId: entry.parentId,
        path: entry.path,
        source: 'workspace',
      }))
      setState((s) => ({
        ...s,
        workspaceItems,
        workspaceRoot: dirPath,
      }))
    } catch (error) {
      window.alert(`Failed to open directory: ${error.message}`)
    }
  }, [])

  const openWorkspaceDoc = useCallback(async (item) => {
    if (!item?.path || item.type !== 'doc') return
    try {
      const content = await readTextFile(item.path)
      await openFile({ path: item.path, name: item.name, content })
    } catch (error) {
      window.alert(`Failed to open file: ${error.message}`)
    }
  }, [openFile])

  const createDoc = useCallback((parentId = null) => {
    if (stateRef.current.workspaceItems.length > 0) return null
    void flush()
    const { localDocs } = stateRef.current
    const name = uniqueName(localDocs, 'Untitled', parentId)
    const doc = createBlankItem(name, 'doc', parentId)
    const nextLocalDocs = [...localDocs, doc]
    saveLocalDocs(nextLocalDocs)
    setState((s) => ({
      ...s,
      localDocs: nextLocalDocs,
      currentDocId: doc.id,
      recentDocIds: touchRecentDocIds(s.recentDocIds, doc.id),
    }))
    const ed = editorRef.current
    if (ed) {
      ed.commands.setContent({ type: 'doc', content: [{ type: 'paragraph' }] })
    }
    localStorage.setItem(CURRENT_KEY, doc.id)
    if (setHash) setHash(doc.id)
    return doc.id
  }, [flush, setHash])

  const createFolder = useCallback((parentId = null) => {
    if (stateRef.current.workspaceItems.length > 0) return null
    const { localDocs } = stateRef.current
    const name = uniqueName(localDocs, 'New Folder', parentId)
    const folder = createBlankItem(name, 'folder', parentId)
    const nextLocalDocs = [...localDocs, folder]
    saveLocalDocs(nextLocalDocs)
    setState((s) => ({ ...s, localDocs: nextLocalDocs }))
    return folder.id
  }, [])

  const deleteItem = useCallback((id) => {
    if (stateRef.current.workspaceItems.length > 0) return

    const { localDocs, currentDocId } = stateRef.current
    const descendantIds = collectDescendants(localDocs, id)
    const allDeleteIds = new Set([id, ...descendantIds])
    const remainingDocs = localDocs.filter((d) => !allDeleteIds.has(d.id) && d.type === 'doc')
    if (remainingDocs.length === 0) return

    if (allDeleteIds.size > 1) {
      if (!window.confirm(`Delete this item and its ${allDeleteIds.size - 1} child item(s)?`)) return
    }

    void flush()

    for (const delId of allDeleteIds) {
      const item = localDocs.find((d) => d.id === delId)
      if (item && item.type === 'doc') {
        localStorage.removeItem(DOC_PREFIX + delId)
      }
    }

    const nextLocalDocs = localDocs.filter((d) => !allDeleteIds.has(d.id))
    saveLocalDocs(nextLocalDocs)

    let nextCurrentId = currentDocId
    if (allDeleteIds.has(currentDocId)) {
      nextCurrentId = remainingDocs[0].id
      localStorage.setItem(CURRENT_KEY, nextCurrentId)
      void loadIntoEditor(nextCurrentId)
      if (setHash) setHash(nextCurrentId)
    }

    setState((s) => ({
      ...s,
      localDocs: nextLocalDocs,
      currentDocId: nextCurrentId,
      recentDocIds: buildRecentDocIds(nextLocalDocs, nextCurrentId, s.recentDocIds),
    }))
    void cleanupOrphanImages(nextLocalDocs)
  }, [flush, loadIntoEditor, setHash])

  const moveItem = useCallback(async (id, newParentId) => {
    const { workspaceItems, workspaceRoot, localDocs, fileDocs } = stateRef.current

    // --- Workspace mode: move on filesystem ---
    if (workspaceItems.length > 0) {
      const item = workspaceItems.find((d) => d.id === id)
      if (!item) return

      // Determine target folder path
      let targetFolderPath
      if (newParentId) {
        const target = workspaceItems.find((d) => d.id === newParentId)
        if (!target || target.type !== 'folder') return
        targetFolderPath = target.path
      } else {
        targetFolderPath = workspaceRoot
      }

      if (!targetFolderPath) return

      // In workspace mode, the actual parentId is the folder path, not null
      const effectiveParentId = newParentId || workspaceRoot

      const newPath = targetFolderPath + '/' + item.name
      if (newPath === item.path) return

      try {
        await moveFile(item.path, newPath)
      } catch (error) {
        window.alert(`Failed to move "${item.name}": ${error.message || error}`)
        return
      }

      // Rewrite paths in workspaceItems for the moved item and all descendants
      const oldPrefix = item.path
      const newPrefix = newPath

      setState((s) => {
        const nextWorkspaceItems = s.workspaceItems.map((d) => {
          if (d.id === id) {
            // The moved item itself
            return { ...d, id: newPath, path: newPath, parentId: effectiveParentId }
          }
          if (d.path.startsWith(oldPrefix + '/')) {
            // A descendant — rewrite the prefix portion
            const suffix = d.path.slice(oldPrefix.length)
            const updatedPath = newPrefix + suffix
            const updatedParentId = d.parentId === oldPrefix
              ? newPath
              : d.parentId?.startsWith(oldPrefix + '/')
                ? newPrefix + d.parentId.slice(oldPrefix.length)
                : d.parentId
            return { ...d, id: updatedPath, path: updatedPath, parentId: updatedParentId }
          }
          return d
        })

        // Update fileDocs if any open tab references moved paths
        const nextFileDocs = s.fileDocs.map((fd) => {
          if (fd.path === oldPrefix) {
            return { ...fd, path: newPath, name: fileNameFromPath(newPath) }
          }
          if (fd.path.startsWith(oldPrefix + '/')) {
            const updatedPath = newPrefix + fd.path.slice(oldPrefix.length)
            return { ...fd, path: updatedPath, name: fileNameFromPath(updatedPath) }
          }
          return fd
        })

        return { ...s, workspaceItems: nextWorkspaceItems, fileDocs: nextFileDocs }
      })
      return
    }

    // --- Local mode: in-memory move ---
    const item = localDocs.find((d) => d.id === id)
    if (!item || item.parentId === newParentId || newParentId === id) return

    const descendants = new Set(collectDescendants(localDocs, id))
    if (newParentId && descendants.has(newParentId)) return

    if (hasDuplicateName(localDocs, item.name, newParentId, id)) {
      const targetName = newParentId
        ? localDocs.find((d) => d.id === newParentId)?.name || 'target folder'
        : 'root'
      window.alert(`"${item.name}" already exists in ${targetName}. Please rename it first.`)
      return
    }

    const nextLocalDocs = localDocs.map((d) =>
      d.id === id ? { ...d, parentId: newParentId, updatedAt: Date.now() } : d
    )
    saveLocalDocs(nextLocalDocs)
    setState((s) => ({ ...s, localDocs: nextLocalDocs }))
  }, [])

  const renameDoc = useCallback((id, name) => {
    const trimmed = name.trim()
    if (!trimmed) return

    const localItem = stateRef.current.localDocs.find((doc) => doc.id === id)
    if (!localItem) {
      window.alert('Files from disk cannot be renamed from the editor yet. Use Save As instead.')
      return
    }

    if (hasDuplicateName(stateRef.current.localDocs, trimmed, localItem.parentId, id)) {
      window.alert(`"${trimmed}" already exists in this location. Please use a different name.`)
      return
    }

    const nextLocalDocs = stateRef.current.localDocs.map((doc) =>
      doc.id === id ? { ...doc, name: trimmed, updatedAt: Date.now() } : doc
    )
    saveLocalDocs(nextLocalDocs)
    setState((s) => ({ ...s, localDocs: nextLocalDocs }))
  }, [])

  const saveCurrentDocAs = useCallback(async () => {
    const ed = editorRef.current
    const currentDoc = getDocById(stateRef.current.currentDocId)
    if (!ed || !currentDoc) return null

    try {
      const markdown = editorToMarkdown(ed)
      const suggestedName = currentDoc.source === 'file'
        ? currentDoc.name
        : `${currentDoc.name.replace(/\.(md|markdown|txt)$/i, '')}.md`
      const savedPath = await saveTextFile(markdown, suggestedName, 'text/markdown')
      if (!savedPath) return null
      if (!isTauri()) {
        setLastSaved(new Date())
        return savedPath
      }

      const nextFileDoc = {
        ...createFileDoc(savedPath, currentDoc.id),
        updatedAt: Date.now(),
      }

      setState((s) => {
        const nextLocalDocs = s.localDocs.filter((doc) => doc.id !== currentDoc.id)
        const nextFileDocs = [
          ...s.fileDocs.filter((doc) => doc.id !== currentDoc.id && doc.path !== savedPath),
          nextFileDoc,
        ]
        saveLocalDocs(nextLocalDocs)
        localStorage.removeItem(DOC_PREFIX + currentDoc.id)
        return {
          ...s,
          localDocs: nextLocalDocs,
          fileDocs: nextFileDocs,
          currentDocId: currentDoc.id,
          recentDocIds: touchRecentDocIds(
            buildRecentDocIds([...nextLocalDocs, ...nextFileDocs], currentDoc.id, s.recentDocIds),
            currentDoc.id
          ),
        }
      })

      localStorage.setItem(CURRENT_KEY, currentDoc.id)
      setLastSaved(new Date())
      return savedPath
    } catch (error) {
      window.alert(`Failed to save file: ${error.message}`)
      return null
    }
  }, [getDocById])

  const saveCurrentDoc = useCallback(async () => {
    const currentDoc = getDocById(stateRef.current.currentDocId)
    if (!currentDoc) return null

    if (currentDoc.source === 'file') {
      try {
        await flush()
        return currentDoc.path
      } catch (error) {
        window.alert(`Failed to save file: ${error.message}`)
        return null
      }
    }

    return saveCurrentDocAs()
  }, [flush, getDocById, saveCurrentDocAs])

  const closeTab = useCallback((id) => {
    const { currentDocId, fileDocs } = stateRef.current
    const allDocs = getAllDocs()
    if (allDocs.length <= 1) return

    const fileDoc = fileDocs.find((doc) => doc.id === id)
    if (!fileDoc) {
      const localDocs = stateRef.current.localDocs.filter((doc) => doc.type === 'doc')
      const isLastLocalDoc = localDocs.length <= 1

      if (id === currentDocId) {
        const ids = stateRef.current.recentDocIds
        const idx = ids.indexOf(id)
        const nextId = ids[idx + 1] || ids[idx - 1]
        if (nextId) void switchDoc(nextId)
      }

      if (isLastLocalDoc) {
        const nextLocalDocs = stateRef.current.localDocs.filter((doc) => doc.id !== id)
        saveLocalDocs(nextLocalDocs)
        localStorage.removeItem(DOC_PREFIX + id)
        setState((s) => ({
          ...s,
          localDocs: nextLocalDocs,
          recentDocIds: s.recentDocIds.filter((docId) => docId !== id),
        }))
      } else {
        setState((s) => ({ ...s, recentDocIds: s.recentDocIds.filter((docId) => docId !== id) }))
      }
      return
    }

    const nextFileDocs = fileDocs.filter((doc) => doc.id !== id)
    const remainingDocs = [...stateRef.current.localDocs, ...nextFileDocs]
    const remainingRecentDocIds = stateRef.current.recentDocIds.filter((docId) => docId !== id)
    let nextCurrentId = currentDocId
    if (id === currentDocId) {
      const ids = stateRef.current.recentDocIds
      const idx = ids.indexOf(id)
      nextCurrentId = ids[idx + 1] || ids[idx - 1] || currentDocId
    }

    setState((s) => ({
      ...s,
      fileDocs: nextFileDocs,
      currentDocId: nextCurrentId,
      recentDocIds: buildRecentDocIds(remainingDocs, nextCurrentId, remainingRecentDocIds),
    }))

    if (id === currentDocId && nextCurrentId && nextCurrentId !== id) {
      localStorage.setItem(CURRENT_KEY, nextCurrentId)
      void loadIntoEditor(nextCurrentId)
      if (setHash) setHash(nextCurrentId)
    }
  }, [getAllDocs, loadIntoEditor, setHash])

  const docs = getAllDocs(state)
  const currentDoc = docs.find((doc) => doc.id === state.currentDocId) || docs[0]
  const visibleTabIds = state.recentDocIds
    .filter((id) => docs.some((doc) => doc.id === id))
    .slice(0, MAX_VISIBLE_TABS)
  const visibleTabs = visibleTabIds
    .map((id) => docs.find((doc) => doc.id === id))
    .filter(Boolean)
  const treeItems = state.workspaceItems.length > 0 ? state.workspaceItems : state.localDocs
  const currentTreeItemId = state.workspaceItems.length > 0 ? currentDoc?.path || null : currentDoc?.id || null
  const currentDocDeleted = currentDoc?.deleted || false

  return {
    docs,
    visibleTabs,
    treeItems,
    treeEditable: state.workspaceItems.length === 0,
    currentDocId: state.currentDocId,
    currentDocName: currentDoc?.name || 'Untitled',
    currentDocPath: currentDoc?.path || null,
    currentDocSource: currentDoc?.source || 'local',
    currentDocDeleted,
    currentTreeItemId,
    lastSaved,
    switchDoc,
    openWorkspaceDoc,
    openFileDialog,
    openDirectory,
    saveCurrentDoc,
    saveCurrentDocAs,
    createDoc,
    createNewFile,
    createFolder,
    deleteItem,
    closeTab,
    moveItem,
    renameDoc,
  }
}
