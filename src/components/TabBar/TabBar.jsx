import { useState, useRef, useEffect } from 'react'
import styles from './TabBar.module.css'

export default function TabBar({ docs, currentDocId, onSwitch, onCreate, onClose, onRename }) {
  const [renamingId, setRenamingId] = useState(null)
  const [renameValue, setRenameValue] = useState('')
  const inputRef = useRef(null)

  useEffect(() => {
    if (renamingId && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [renamingId])

  const handleDoubleClick = (doc) => {
    setRenamingId(doc.id)
    setRenameValue(doc.name)
  }

  const commitRename = () => {
    if (renamingId) {
      const trimmed = renameValue.trim()
      if (trimmed) {
        onRename(renamingId, trimmed)
      }
      setRenamingId(null)
    }
  }

  const cancelRename = () => {
    setRenamingId(null)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      commitRename()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      cancelRename()
    }
  }

  return (
    <div className={styles.tabBar} data-no-print>
      {docs.map((doc) => (
        <div
          key={doc.id}
          className={`${styles.tab} ${doc.id === currentDocId ? styles.active : ''}`}
          onClick={() => {
            if (renamingId !== doc.id) onSwitch(doc.id)
          }}
          onDoubleClick={() => handleDoubleClick(doc)}
        >
          {renamingId === doc.id ? (
            <input
              ref={inputRef}
              className={styles.renameInput}
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={commitRename}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span className={styles.tabName}>{doc.name}</span>
          )}
          {docs.length > 1 && renamingId !== doc.id && (
            <button
              className={styles.closeBtn}
              onClick={(e) => {
                e.stopPropagation()
                onClose(doc.id)
              }}
              title="Close document"
            >
              ×
            </button>
          )}
        </div>
      ))}
      <button className={styles.newBtn} onClick={onCreate} title="New document">
        +
      </button>
    </div>
  )
}
