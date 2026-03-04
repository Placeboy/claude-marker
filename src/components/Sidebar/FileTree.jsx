import { useState, useEffect, useRef, useCallback } from 'react'
import ContextMenu from './ContextMenu'
import styles from './FileTree.module.css'

const EXPANDED_KEY = 'markdown-editor-expanded'

function loadExpanded() {
  try {
    const raw = localStorage.getItem(EXPANDED_KEY)
    if (raw) return new Set(JSON.parse(raw))
  } catch { /* ignore */ }
  return new Set()
}

function saveExpanded(set) {
  localStorage.setItem(EXPANDED_KEY, JSON.stringify([...set]))
}

// Build nested tree from flat array. Folders first, then alphabetical (case-insensitive).
function buildTree(items, parentId) {
  const children = items
    .filter((item) => item.parentId === parentId)
    .sort((a, b) => {
      if (a.type !== b.type) return a.type === 'folder' ? -1 : 1
      return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
    })
  return children.map((item) => ({
    ...item,
    children: buildTree(items, item.id),
  }))
}

function hasChildren(items, id) {
  return items.some((item) => item.parentId === id)
}

// Collect all descendant IDs
function collectDescendantIds(items, id) {
  const kids = items.filter((d) => d.parentId === id)
  let ids = new Set()
  for (const kid of kids) {
    ids.add(kid.id)
    for (const desc of collectDescendantIds(items, kid.id)) {
      ids.add(desc)
    }
  }
  return ids
}

export default function FileTree({
  docs,
  currentDocId,
  onSwitchDoc,
  onCreateDoc,
  onCreateFolder,
  onDeleteItem,
  onMoveItem,
  onRename,
}) {
  const [expanded, setExpanded] = useState(loadExpanded)
  const [renamingId, setRenamingId] = useState(null)
  const [renameValue, setRenameValue] = useState('')
  const [contextMenu, setContextMenu] = useState(null)
  const [dragOverId, setDragOverId] = useState(null)
  const [draggingId, setDraggingId] = useState(null)
  const inputRef = useRef(null)
  const treeContentRef = useRef(null)
  const expandTimerRef = useRef(null)

  // Persist expanded state
  useEffect(() => {
    saveExpanded(expanded)
  }, [expanded])

  // Auto-focus rename input
  useEffect(() => {
    if (renamingId && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [renamingId])

  const toggleExpand = useCallback((id) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const ensureExpanded = useCallback((id) => {
    setExpanded((prev) => {
      if (prev.has(id)) return prev
      const next = new Set(prev)
      next.add(id)
      return next
    })
  }, [])

  const commitRename = useCallback(() => {
    if (renamingId && renameValue.trim()) {
      onRename(renamingId, renameValue.trim())
    }
    setRenamingId(null)
  }, [renamingId, renameValue, onRename])

  const handleRenameKeyDown = useCallback((e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      commitRename()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setRenamingId(null)
    }
  }, [commitRename])

  const handleContextMenu = useCallback((e, itemId = null, itemType = null) => {
    e.preventDefault()
    e.stopPropagation()
    setContextMenu({ x: e.clientX, y: e.clientY, itemId, itemType })
  }, [])

  const handleContextRename = useCallback((id) => {
    const item = docs.find((d) => d.id === id)
    if (item) {
      setRenamingId(id)
      setRenameValue(item.name)
    }
  }, [docs])

  const handleContextCreateDoc = useCallback((parentId) => {
    if (parentId) ensureExpanded(parentId)
    onCreateDoc(parentId)
  }, [onCreateDoc, ensureExpanded])

  const handleContextCreateFolder = useCallback((parentId) => {
    if (parentId) ensureExpanded(parentId)
    onCreateFolder(parentId)
  }, [onCreateFolder, ensureExpanded])

  // --- Drag helpers ---
  const clearExpandTimer = useCallback(() => {
    if (expandTimerRef.current) {
      clearTimeout(expandTimerRef.current)
      expandTimerRef.current = null
    }
  }, [])

  const canDrop = useCallback((sourceId, targetId) => {
    if (!sourceId || sourceId === targetId) return false
    // Can't drop onto own descendant
    const descendants = collectDescendantIds(docs, sourceId)
    if (targetId && descendants.has(targetId)) return false
    // Can't drop onto current parent (no-op)
    const source = docs.find((d) => d.id === sourceId)
    if (source && source.parentId === targetId) return false
    return true
  }, [docs])

  const handleDrop = useCallback((targetId) => {
    clearExpandTimer()
    if (draggingId && canDrop(draggingId, targetId)) {
      onMoveItem(draggingId, targetId)
      if (targetId) ensureExpanded(targetId)
    }
    setDragOverId(null)
    setDraggingId(null)
  }, [draggingId, canDrop, onMoveItem, ensureExpanded, clearExpandTimer])

  const tree = buildTree(docs, null)

  function TreeNode({ node, depth }) {
    const isFolder = node.type === 'folder'
    const hasKids = node.children.length > 0 || hasChildren(docs, node.id)
    const isExpanded = expanded.has(node.id)
    const isActive = node.type === 'doc' && node.id === currentDocId
    const isRenaming = renamingId === node.id
    const showChevron = isFolder || hasKids
    const isDragOver = dragOverId === node.id && draggingId !== node.id
    const isDragging = draggingId === node.id

    const handleClick = () => {
      if (isRenaming) return
      if (isFolder) {
        toggleExpand(node.id)
      } else {
        onSwitchDoc(node.id)
      }
    }

    const handleDoubleClick = (e) => {
      e.stopPropagation()
      setRenamingId(node.id)
      setRenameValue(node.name)
    }

    const handleRightClick = (e) => {
      handleContextMenu(e, node.id, node.type)
    }

    // --- Drag source ---
    const handleDragStart = (e) => {
      if (isRenaming) {
        e.preventDefault()
        return
      }
      setDraggingId(node.id)
      e.dataTransfer.effectAllowed = 'move'
      e.dataTransfer.setData('text/plain', node.id)
    }

    const handleDragEnd = () => {
      setDraggingId(null)
      setDragOverId(null)
      clearExpandTimer()
    }

    // --- Drop target ---
    const handleDragOver = (e) => {
      if (!draggingId || !canDrop(draggingId, node.id)) return
      e.preventDefault()
      e.dataTransfer.dropEffect = 'move'
      if (dragOverId !== node.id) {
        setDragOverId(node.id)
        clearExpandTimer()
        // Auto-expand folders/parents after hovering 600ms
        if ((isFolder || hasKids) && !isExpanded) {
          expandTimerRef.current = setTimeout(() => {
            ensureExpanded(node.id)
          }, 600)
        }
      }
    }

    const handleDragLeave = (e) => {
      // Only clear if truly leaving this element (not entering a child)
      if (!e.currentTarget.contains(e.relatedTarget)) {
        if (dragOverId === node.id) {
          setDragOverId(null)
          clearExpandTimer()
        }
      }
    }

    const handleDropOnNode = (e) => {
      e.preventDefault()
      e.stopPropagation()
      handleDrop(node.id)
    }

    return (
      <>
        <div
          className={
            `${styles.treeItem}` +
            `${isActive ? ` ${styles.active}` : ''}` +
            `${isDragOver ? ` ${styles.dropTarget}` : ''}` +
            `${isDragging ? ` ${styles.dragging}` : ''}`
          }
          style={{ paddingLeft: 12 + depth * 16 }}
          onClick={handleClick}
          onDoubleClick={handleDoubleClick}
          onContextMenu={handleRightClick}
          draggable={!isRenaming}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDropOnNode}
        >
          {showChevron ? (
            <span
              className={`${styles.chevron} ${isExpanded ? styles.expanded : ''}`}
              onClick={(e) => {
                e.stopPropagation()
                toggleExpand(node.id)
              }}
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                <path d="M4.5 2L8.5 6L4.5 10V2Z" />
              </svg>
            </span>
          ) : (
            <span className={styles.chevronPlaceholder} />
          )}

          <span className={styles.icon}>
            {isFolder ? '\uD83D\uDCC1' : '\uD83D\uDCC4'}
          </span>

          {isRenaming ? (
            <input
              ref={inputRef}
              className={styles.renameInput}
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={handleRenameKeyDown}
              onBlur={commitRename}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span className={styles.itemName}>{node.name}</span>
          )}
        </div>

        {isExpanded &&
          node.children.map((child) => (
            <TreeNode key={child.id} node={child} depth={depth + 1} />
          ))}
      </>
    )
  }

  // Drop on blank area → move to root
  const handleTreeContentDragOver = (e) => {
    if (!draggingId) return
    const source = docs.find((d) => d.id === draggingId)
    if (source && source.parentId === null) return // already at root
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (dragOverId !== '__root__') {
      setDragOverId('__root__')
      clearExpandTimer()
    }
  }

  const handleTreeContentDragLeave = (e) => {
    if (!e.currentTarget.contains(e.relatedTarget)) {
      if (dragOverId === '__root__') {
        setDragOverId(null)
      }
    }
  }

  const handleTreeContentDrop = (e) => {
    e.preventDefault()
    handleDrop(null)
  }

  return (
    <div className={styles.fileTree}>
      <div className={styles.sectionHeader}>Files</div>
      <div
        ref={treeContentRef}
        className={`${styles.treeContent} ${dragOverId === '__root__' ? styles.rootDropTarget : ''}`}
        onContextMenu={(e) => {
          if (e.target === treeContentRef.current) {
            handleContextMenu(e)
          }
        }}
        onDragOver={handleTreeContentDragOver}
        onDragLeave={handleTreeContentDragLeave}
        onDrop={handleTreeContentDrop}
      >
        {tree.map((node) => (
          <TreeNode key={node.id} node={node} depth={0} />
        ))}
      </div>

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          itemId={contextMenu.itemId}
          itemType={contextMenu.itemType}
          onCreateDoc={handleContextCreateDoc}
          onCreateFolder={handleContextCreateFolder}
          onRename={handleContextRename}
          onDelete={onDeleteItem}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  )
}
