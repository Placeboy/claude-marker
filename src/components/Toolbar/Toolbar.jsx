import { useState, useEffect, useRef } from 'react'
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

function editorToMarkdown(editor) {
  // Convert TipTap JSON to markdown via HTML + turndown
  const html = editor.getHTML()
  const TurndownService = window.__TurndownService
  if (TurndownService) {
    const td = new TurndownService({
      headingStyle: 'atx',
      codeBlockStyle: 'fenced',
    })
    td.addRule('taskList', {
      filter: (node) => node.nodeName === 'LI' && node.parentNode?.getAttribute('data-type') === 'taskList',
      replacement: (content, node) => {
        const checked = node.getAttribute('data-checked') === 'true'
        return `${checked ? '- [x]' : '- [ ]'} ${content.trim()}\n`
      },
    })
    td.addRule('highlight', {
      filter: 'mark',
      replacement: (content) => `==${content}==`,
    })
    return td.turndown(html)
  }
  // Fallback: simple HTML output
  return html
}

export default function Toolbar({ editor, lastSaved, docName }) {
  const [, forceUpdate] = useState(0)
  const [exportMenuOpen, setExportMenuOpen] = useState(false)
  const exportRef = useRef(null)

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
    if (!exportMenuOpen) return
    const handleMouseDown = (e) => {
      if (exportRef.current && !exportRef.current.contains(e.target)) {
        setExportMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [exportMenuOpen])

  if (!editor) return null

  const handleExportMarkdown = () => {
    setExportMenuOpen(false)
    import('turndown').then(({ default: TurndownService }) => {
      window.__TurndownService = TurndownService
      const md = editorToMarkdown(editor)
      const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = (docName || 'document') + '.md'
      a.click()
      URL.revokeObjectURL(url)
    })
  }

  const handleExportPdf = () => {
    setExportMenuOpen(false)
    window.print()
  }

  const handleImport = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.md,.markdown,.txt'
    input.onchange = (e) => {
      const file = e.target.files[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = (ev) => {
        const text = ev.target.result
        // Convert markdown to HTML-ish content (basic conversion)
        const html = markdownToHtml(text)
        editor.commands.setContent(html)
      }
      reader.readAsText(file)
    }
    input.click()
  }

  const formatTime = (date) => {
    if (!date) return ''
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
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
      </div>

      <div className={styles.right}>
        {lastSaved && (
          <span className={styles.saved}>Saved {formatTime(lastSaved)}</span>
        )}
        <button className={styles.fileBtn} onClick={handleImport} title="Import .md file">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Import
        </button>
        <div className={styles.exportWrapper} ref={exportRef}>
          <button
            className={styles.fileBtn}
            onClick={() => setExportMenuOpen((v) => !v)}
            title="Export document"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            Export
          </button>
          {exportMenuOpen && (
            <div className={styles.exportMenu}>
              <button className={styles.exportMenuItem} onClick={handleExportMarkdown}>
                Markdown (.md)
              </button>
              <button className={styles.exportMenuItem} onClick={handleExportPdf}>
                PDF (.pdf)
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Simple markdown to HTML converter for import
function markdownToHtml(md) {
  // Step 1: Extract fenced code blocks to protect them from inline processing
  const codeBlocks = []
  let processed = md.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
    const placeholder = `\x00CODEBLOCK${codeBlocks.length}\x00`
    const langAttr = lang ? ` class="language-${lang}"` : ''
    codeBlocks.push(`<pre><code${langAttr}>${escapeHtml(code.trim())}</code></pre>`)
    return placeholder
  })

  // Step 2: Apply inline formatting first (before block-level consumes the lines)
  processed = processed
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/~~(.+?)~~/g, '<s>$1</s>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/==(.+?)==/g, '<mark>$1</mark>')
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>')

  // Step 3: Block-level elements
  processed = processed
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/^---$/gm, '<hr>')
    .replace(/^\*\*\*$/gm, '<hr>')
    .replace(/^> (.+)$/gm, '<blockquote><p>$1</p></blockquote>')
    .replace(/^- \[x\] (.+)$/gm, '<ul data-type="taskList"><li data-checked="true"><p>$1</p></li></ul>')
    .replace(/^- \[ \] (.+)$/gm, '<ul data-type="taskList"><li data-checked="false"><p>$1</p></li></ul>')
    .replace(/^[-*] (.+)$/gm, '<ul><li><p>$1</p></li></ul>')
    .replace(/^\d+\. (.+)$/gm, '<ol><li><p>$1</p></li></ol>')

  // Step 4: Wrap remaining plain lines as paragraphs
  processed = processed.replace(
    /^(?!<[hupob]|<li|<hr|<code|<pre|\x00CODEBLOCK)(.+)$/gm,
    '<p>$1</p>'
  )

  // Step 5: Merge consecutive same-type lists
  processed = processed
    .replace(/<\/ul>\n<ul data-type="taskList">/g, '\n')
    .replace(/<\/ul>\n<ul>/g, '\n')
    .replace(/<\/ol>\n<ol>/g, '\n')

  // Step 6: Restore code blocks
  codeBlocks.forEach((block, i) => {
    processed = processed.replace(`\x00CODEBLOCK${i}\x00`, block)
  })

  // Clean up empty lines
  processed = processed.replace(/\n{2,}/g, '\n')

  return processed
}

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}
