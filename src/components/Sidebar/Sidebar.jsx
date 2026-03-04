import { useState, useRef, useCallback, useEffect } from 'react'
import FileTree from './FileTree'
import styles from './Sidebar.module.css'

const SPLIT_KEY = 'markdown-editor-split'
const MIN_TOC = 80
const MIN_FILES = 120

function loadSplit() {
  try {
    const v = localStorage.getItem(SPLIT_KEY)
    if (v) return Number(v)
  } catch { /* ignore */ }
  return null
}

export default function Sidebar({
  headings,
  activeId,
  open,
  onToggle,
  editor,
  docs,
  currentDocId,
  onSwitchDoc,
  onCreateDoc,
  onCreateFolder,
  onDeleteItem,
  onMoveItem,
  onRename,
}) {
  const sidebarRef = useRef(null)
  const [tocHeight, setTocHeight] = useState(loadSplit)
  const dragging = useRef(false)

  const handleDragStart = useCallback((e) => {
    e.preventDefault()
    dragging.current = true
    document.body.style.cursor = 'row-resize'
    document.body.style.userSelect = 'none'
  }, [])

  useEffect(() => {
    const handleMove = (e) => {
      if (!dragging.current || !sidebarRef.current) return
      const rect = sidebarRef.current.getBoundingClientRect()
      const y = e.clientY - rect.top
      const total = rect.height
      let newTocH = total - y
      newTocH = Math.max(MIN_TOC, Math.min(total - MIN_FILES, newTocH))
      setTocHeight(newTocH)
    }
    const handleUp = () => {
      if (!dragging.current) return
      dragging.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      // persist
      setTocHeight((h) => {
        if (h != null) localStorage.setItem(SPLIT_KEY, String(h))
        return h
      })
    }
    document.addEventListener('mousemove', handleMove)
    document.addEventListener('mouseup', handleUp)
    return () => {
      document.removeEventListener('mousemove', handleMove)
      document.removeEventListener('mouseup', handleUp)
    }
  }, [])

  const scrollToHeading = (heading) => {
    if (!editor) return

    const editorElement = editor.view.dom
    const headingElements = editorElement.querySelectorAll('h1, h2, h3')

    // Find the matching heading element
    const index = headings.indexOf(heading)
    if (index >= 0 && headingElements[index]) {
      headingElements[index].scrollIntoView({ behavior: 'smooth', block: 'start' })
    }

    // Also move cursor to that heading
    editor.chain().focus().setTextSelection(heading.pos + 1).run()
  }

  return (
    <>
      <button
        className={styles.toggle}
        onClick={onToggle}
        title={open ? 'Hide sidebar' : 'Show sidebar'}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          {open ? (
            <>
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <line x1="9" y1="3" x2="9" y2="21" />
            </>
          ) : (
            <>
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </>
          )}
        </svg>
      </button>

      <aside ref={sidebarRef} className={`${styles.sidebar} ${open ? styles.open : styles.closed}`}>
        <div className={styles.fileSection}>
          <FileTree
            docs={docs}
            currentDocId={currentDocId}
            onSwitchDoc={onSwitchDoc}
            onCreateDoc={onCreateDoc}
            onCreateFolder={onCreateFolder}
            onDeleteItem={onDeleteItem}
            onMoveItem={onMoveItem}
            onRename={onRename}
          />
        </div>

        <div className={styles.divider} onMouseDown={handleDragStart} />

        <div
          className={styles.tocSection}
          style={tocHeight != null ? { height: tocHeight, maxHeight: 'none' } : undefined}
        >
          <div className={styles.header}>
            <span className={styles.title}>Table of Contents</span>
          </div>

          <nav className={styles.nav}>
            {headings.length === 0 ? (
              <p className={styles.empty}>Add headings to see the table of contents</p>
            ) : (
              headings.map((heading) => (
                <button
                  key={heading.id}
                  className={`${styles.link} ${styles[`level${heading.level}`]} ${
                    activeId === heading.id ? styles.active : ''
                  }`}
                  onClick={() => scrollToHeading(heading)}
                  title={heading.text}
                >
                  {heading.text}
                </button>
              ))
            )}
          </nav>
        </div>
      </aside>
    </>
  )
}
