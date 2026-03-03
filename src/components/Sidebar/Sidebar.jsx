import styles from './Sidebar.module.css'

export default function Sidebar({ headings, activeId, open, onToggle, editor }) {
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

      <aside className={`${styles.sidebar} ${open ? styles.open : styles.closed}`}>
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
      </aside>
    </>
  )
}
