import { useState, useEffect, useRef } from 'react'
import { saveImage, getImageUrl } from '../../utils/imageStore.js'
import styles from './Toolbar.module.css'

function ToolbarButton({ onClick, active, title, children }) {
  return (
    <button
      className={`${styles.btn} ${active ? styles.active : ''}`}
      onClick={onClick}
      title={title}
      type="button"
    >
      {children}
    </button>
  )
}

function Separator() {
  return <div className={styles.separator} />
}

export default function Toolbar({
  editor,
}) {
  const [, forceUpdate] = useState(0)
  const [imageMenuOpen, setImageMenuOpen] = useState(false)
  const imageRef = useRef(null)

  useEffect(() => {
    if (!editor) return
    const handler = () => forceUpdate((n) => n + 1)
    editor.on('selectionUpdate', handler)
    editor.on('transaction', handler)
    return () => {
      editor.off('selectionUpdate', handler)
      editor.off('transaction', handler)
    }
  }, [editor])

  useEffect(() => {
    if (!imageMenuOpen) return
    const handleMouseDown = (e) => {
      if (imageMenuOpen && imageRef.current && !imageRef.current.contains(e.target)) {
        setImageMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [imageMenuOpen])

  if (!editor) return null

  const handleUploadImage = () => {
    setImageMenuOpen(false)
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.onchange = async (e) => {
      const file = e.target.files[0]
      if (!file) return
      const id = await saveImage(file)
      const url = await getImageUrl(id)
      editor.chain().focus().setImage({ src: url, 'data-image-id': id }).run()
    }
    input.click()
  }

  const handleImageUrl = () => {
    setImageMenuOpen(false)
    const url = window.prompt('Enter image URL:', 'https://')
    if (!url || url === 'https://') return
    editor.chain().focus().setImage({ src: url }).run()
  }
  return (
    <div className={styles.toolbar} data-no-print>
      <div className={styles.left}>
        <div className={styles.group}>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBold().run()}
            active={editor.isActive('bold')}
            title="Bold (Cmd+B)"
          >
            <strong>B</strong>
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleItalic().run()}
            active={editor.isActive('italic')}
            title="Italic (Cmd+I)"
          >
            <em>I</em>
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            active={editor.isActive('underline')}
            title="Underline (Cmd+U)"
          >
            <span style={{ textDecoration: 'underline' }}>U</span>
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleStrike().run()}
            active={editor.isActive('strike')}
            title="Strikethrough (Cmd+Shift+S)"
          >
            <span style={{ textDecoration: 'line-through' }}>S</span>
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleCode().run()}
            active={editor.isActive('code')}
            title="Inline Code (Cmd+E)"
          >
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}>&lt;/&gt;</span>
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHighlight().run()}
            active={editor.isActive('highlight')}
            title="Highlight (Cmd+Shift+H)"
          >
            <span style={{ background: 'var(--color-highlight)', padding: '0 2px', borderRadius: '2px' }}>H</span>
          </ToolbarButton>
        </div>

        <Separator />

        <div className={styles.group}>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            active={editor.isActive('heading', { level: 1 })}
            title="Heading 1"
          >
            H1
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            active={editor.isActive('heading', { level: 2 })}
            title="Heading 2"
          >
            H2
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            active={editor.isActive('heading', { level: 3 })}
            title="Heading 3"
          >
            H3
          </ToolbarButton>
        </div>

        <Separator />

        <div className={styles.group}>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            active={editor.isActive('bulletList')}
            title="Bullet List"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="9" y1="6" x2="20" y2="6" />
              <line x1="9" y1="12" x2="20" y2="12" />
              <line x1="9" y1="18" x2="20" y2="18" />
              <circle cx="4" cy="6" r="1.5" fill="currentColor" stroke="none" />
              <circle cx="4" cy="12" r="1.5" fill="currentColor" stroke="none" />
              <circle cx="4" cy="18" r="1.5" fill="currentColor" stroke="none" />
            </svg>
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            active={editor.isActive('orderedList')}
            title="Ordered List"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="10" y1="6" x2="20" y2="6" />
              <line x1="10" y1="12" x2="20" y2="12" />
              <line x1="10" y1="18" x2="20" y2="18" />
              <text x="2" y="8" fontSize="7" fill="currentColor" stroke="none" fontFamily="sans-serif">1</text>
              <text x="2" y="14" fontSize="7" fill="currentColor" stroke="none" fontFamily="sans-serif">2</text>
              <text x="2" y="20" fontSize="7" fill="currentColor" stroke="none" fontFamily="sans-serif">3</text>
            </svg>
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            active={editor.isActive('blockquote')}
            title="Quote"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M4.583 17.321C3.553 16.227 3 15 3 13.011c0-3.5 2.457-6.637 6.03-8.188l.893 1.378c-3.335 1.804-3.987 4.145-4.247 5.621.537-.278 1.24-.375 1.929-.311C9.591 11.689 11 13.171 11 15c0 1.933-1.567 3.5-3.5 3.5-1.171 0-2.36-.57-2.917-1.179zM15.583 17.321C14.553 16.227 14 15 14 13.011c0-3.5 2.457-6.637 6.03-8.188l.893 1.378c-3.335 1.804-3.987 4.145-4.247 5.621.537-.278 1.24-.375 1.929-.311C20.591 11.689 22 13.171 22 15c0 1.933-1.567 3.5-3.5 3.5-1.171 0-2.36-.57-2.917-1.179z" />
            </svg>
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleCodeBlock().run()}
            active={editor.isActive('codeBlock')}
            title="Code Block"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="16 18 22 12 16 6" />
              <polyline points="8 6 2 12 8 18" />
            </svg>
          </ToolbarButton>
        </div>

        <Separator />

        <div className={styles.exportWrapper} ref={imageRef}>
          <ToolbarButton
            onClick={() => setImageMenuOpen((v) => !v)}
            title="Insert Image"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
          </ToolbarButton>
          {imageMenuOpen && (
            <div className={styles.exportMenu}>
              <button className={styles.exportMenuItem} onClick={handleUploadImage}>
                Upload Image
              </button>
              <button className={styles.exportMenuItem} onClick={handleImageUrl}>
                Image URL
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
