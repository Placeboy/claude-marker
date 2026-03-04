import { useEffect, useRef } from 'react'
import styles from './ContextMenu.module.css'

export default function ContextMenu({
  x,
  y,
  itemId,
  itemType,
  onCreateDoc,
  onCreateFolder,
  onRename,
  onDelete,
  onClose,
}) {
  const menuRef = useRef(null)

  // Close on outside click or Escape
  useEffect(() => {
    const handleClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        onClose()
      }
    }
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose])

  // Adjust position if overflowing viewport
  useEffect(() => {
    if (!menuRef.current) return
    const rect = menuRef.current.getBoundingClientRect()
    if (rect.right > window.innerWidth) {
      menuRef.current.style.left = `${window.innerWidth - rect.width - 4}px`
    }
    if (rect.bottom > window.innerHeight) {
      menuRef.current.style.top = `${window.innerHeight - rect.height - 4}px`
    }
  }, [x, y])

  const handleAction = (action) => {
    action()
    onClose()
  }

  // Build menu items based on target
  let items = []

  if (!itemId) {
    // Blank area
    items = [
      { label: 'New File', action: () => onCreateDoc(null) },
      { label: 'New Folder', action: () => onCreateFolder(null) },
    ]
  } else if (itemType === 'folder') {
    items = [
      { label: 'New File', action: () => onCreateDoc(itemId) },
      { label: 'New Folder', action: () => onCreateFolder(itemId) },
      { separator: true },
      { label: 'Rename', action: () => onRename(itemId) },
      { label: 'Delete', action: () => onDelete(itemId), danger: true },
    ]
  } else {
    // doc
    items = [
      { label: 'New Sub-file', action: () => onCreateDoc(itemId) },
      { separator: true },
      { label: 'Rename', action: () => onRename(itemId) },
      { label: 'Delete', action: () => onDelete(itemId), danger: true },
    ]
  }

  return (
    <div
      ref={menuRef}
      className={styles.contextMenu}
      style={{ left: x, top: y }}
    >
      {items.map((item, i) =>
        item.separator ? (
          <div key={i} className={styles.separator} />
        ) : (
          <button
            key={i}
            className={`${styles.menuItem} ${item.danger ? styles.danger : ''}`}
            onClick={() => handleAction(item.action)}
          >
            {item.label}
          </button>
        )
      )}
    </div>
  )
}
