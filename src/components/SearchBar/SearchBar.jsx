import { useState, useEffect, useRef, useCallback } from 'react'
import styles from './SearchBar.module.css'

export default function SearchBar({ editor, visible, showReplace, onClose, onToggleReplace }) {
  const searchInputRef = useRef(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [replaceTerm, setReplaceTerm] = useState('')
  const [caseSensitive, setCaseSensitive] = useState(false)
  const [matchCount, setMatchCount] = useState(0)
  const [matchIndex, setMatchIndex] = useState(0)

  // Sync match count/index from editor storage on every transaction
  useEffect(() => {
    if (!editor || !visible) return
    const onTransaction = () => {
      const s = editor.storage.searchReplace
      if (s) {
        setMatchCount(s.results.length)
        setMatchIndex(s.resultIndex)
      }
    }
    editor.on('transaction', onTransaction)
    return () => editor.off('transaction', onTransaction)
  }, [editor, visible])

  // Auto-focus and pre-fill from selection when opened
  useEffect(() => {
    if (!visible || !editor) return
    const { from, to } = editor.state.selection
    if (from !== to) {
      const selectedText = editor.state.doc.textBetween(from, to, ' ')
      if (selectedText && selectedText.length < 200) {
        setSearchTerm(selectedText)
        editor.commands.setSearchTerm(selectedText)
      }
    }
    // Delay focus to ensure the input is rendered
    requestAnimationFrame(() => searchInputRef.current?.focus())
  }, [visible, editor])

  // Clear search when closed
  useEffect(() => {
    if (!visible && editor) {
      editor.commands.setSearchTerm('')
    }
  }, [visible, editor])

  const handleSearchChange = useCallback((e) => {
    const val = e.target.value
    setSearchTerm(val)
    editor?.commands.setSearchTerm(val)
  }, [editor])

  const handleReplaceChange = useCallback((e) => {
    const val = e.target.value
    setReplaceTerm(val)
    editor?.commands.setReplaceTerm(val)
  }, [editor])

  const handleToggleCase = useCallback(() => {
    const next = !caseSensitive
    setCaseSensitive(next)
    editor?.commands.setCaseSensitive(next)
  }, [caseSensitive, editor])

  const handleNext = useCallback(() => {
    editor?.commands.goToNextResult()
  }, [editor])

  const handlePrev = useCallback(() => {
    editor?.commands.goToPrevResult()
  }, [editor])

  const handleReplace = useCallback(() => {
    editor?.commands.replaceCurrentResult()
  }, [editor])

  const handleReplaceAll = useCallback(() => {
    editor?.commands.replaceAll()
  }, [editor])

  const handleSearchKeyDown = useCallback((e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (e.shiftKey) {
        handlePrev()
      } else {
        handleNext()
      }
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    }
  }, [handleNext, handlePrev, onClose])

  const handleReplaceKeyDown = useCallback((e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleReplace()
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    }
  }, [handleReplace, onClose])

  // Prevent mousedown on buttons from stealing editor focus
  const preventFocus = useCallback((e) => e.preventDefault(), [])

  if (!visible) return null

  const countLabel = searchTerm
    ? matchCount > 0 ? `${matchIndex + 1} of ${matchCount}` : 'No results'
    : ''

  return (
    <div className={styles.searchBar} data-no-print>
      {/* Search row */}
      <div className={styles.row}>
        <button
          className={styles.btn}
          onMouseDown={preventFocus}
          onClick={onToggleReplace}
          title={showReplace ? 'Hide replace' : 'Show replace'}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
            {showReplace
              ? <path d="M11 4L8 8l3 4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              : <path d="M5 4l3 4-3 4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            }
          </svg>
        </button>
        <input
          ref={searchInputRef}
          className={styles.input}
          type="text"
          placeholder="Find"
          value={searchTerm}
          onChange={handleSearchChange}
          onKeyDown={handleSearchKeyDown}
        />
        <span className={styles.count}>{countLabel}</span>
        <button className={`${styles.btn} ${caseSensitive ? styles.btnActive : ''}`} onMouseDown={preventFocus} onClick={handleToggleCase} title="Match case">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
            <text x="2" y="12" fontSize="11" fontWeight="bold" fontFamily="serif">Aa</text>
          </svg>
        </button>
        <button className={styles.btn} onMouseDown={preventFocus} onClick={handlePrev} title="Previous match (Shift+Enter)">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
            <path d="M4 10l4-4 4 4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <button className={styles.btn} onMouseDown={preventFocus} onClick={handleNext} title="Next match (Enter)">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
            <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <button className={styles.btn} onMouseDown={preventFocus} onClick={onClose} title="Close (Escape)">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
            <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* Replace row */}
      {showReplace && (
        <div className={styles.row}>
          {/* Spacer to align with search input (matches chevron button width + gap) */}
          <div style={{ width: 26, flexShrink: 0 }} />
          <input
            className={styles.input}
            type="text"
            placeholder="Replace"
            value={replaceTerm}
            onChange={handleReplaceChange}
            onKeyDown={handleReplaceKeyDown}
          />
          <button className={styles.textBtn} onMouseDown={preventFocus} onClick={handleReplace}>Replace</button>
          <button className={styles.textBtn} onMouseDown={preventFocus} onClick={handleReplaceAll}>All</button>
        </div>
      )}
    </div>
  )
}
