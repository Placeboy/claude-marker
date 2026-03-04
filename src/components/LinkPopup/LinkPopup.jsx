import { useState, useEffect, useCallback } from 'react'
import styles from './LinkPopup.module.css'

export default function LinkPopup({ editor }) {
  const [linkInfo, setLinkInfo] = useState(null)

  const updateLink = useCallback(() => {
    if (!editor) {
      setLinkInfo(null)
      return
    }

    const { from, to } = editor.state.selection
    // Only show for cursor (collapsed or small range) inside a link
    if (to - from > 200) {
      setLinkInfo(null)
      return
    }

    const linkMark = editor.isActive('link')
    if (!linkMark) {
      setLinkInfo(null)
      return
    }

    const href = editor.getAttributes('link').href
    if (!href) {
      setLinkInfo(null)
      return
    }

    // Find the <a> DOM element to position the popup
    try {
      const domAtPos = editor.view.domAtPos(from)
      let node = domAtPos.node
      if (node.nodeType === Node.TEXT_NODE) node = node.parentElement
      const anchor = node.closest('a')
      if (!anchor) {
        setLinkInfo(null)
        return
      }
      const rect = anchor.getBoundingClientRect()
      setLinkInfo({ href, rect })
    } catch {
      setLinkInfo(null)
    }
  }, [editor])

  useEffect(() => {
    if (!editor) return

    editor.on('selectionUpdate', updateLink)
    editor.on('blur', () => setLinkInfo(null))

    return () => {
      editor.off('selectionUpdate', updateLink)
      editor.off('blur', () => setLinkInfo(null))
    }
  }, [editor, updateLink])

  if (!linkInfo) return null

  const { href, rect } = linkInfo

  const handleOpen = () => {
    window.open(href, '_blank', 'noopener,noreferrer')
  }

  const handleEdit = () => {
    const newUrl = window.prompt('Edit URL:', href)
    if (newUrl === null) return
    if (newUrl === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
    } else {
      editor.chain().focus().extendMarkRange('link').setLink({ href: newUrl }).run()
    }
  }

  const handleUnlink = () => {
    editor.chain().focus().extendMarkRange('link').unsetLink().run()
  }

  return (
    <div
      className={styles.popup}
      style={{
        top: rect.bottom + 4,
        left: rect.left,
      }}
      onMouseDown={(e) => e.preventDefault()}
    >
      <span className={styles.url} title={href}>{href}</span>
      <button className={styles.btn} onClick={handleOpen} title="Open link">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
          <polyline points="15 3 21 3 21 9" />
          <line x1="10" y1="14" x2="21" y2="3" />
        </svg>
      </button>
      <button className={styles.btn} onClick={handleEdit} title="Edit link">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
          <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
        </svg>
      </button>
      <button className={styles.btn} onClick={handleUnlink} title="Remove link">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 6L6 18" />
          <path d="M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}
