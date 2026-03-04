import { useEffect, useRef } from 'react'
import styles from './PasteBookmarkPopup.module.css'

export default function PasteBookmarkPopup({ url, position, onPasteAsText, onPasteAsBookmark, onDismiss }) {
  const popupRef = useRef(null)

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onDismiss()
      }
    }

    const handleClickOutside = (e) => {
      if (popupRef.current && !popupRef.current.contains(e.target)) {
        onDismiss()
      }
    }

    document.addEventListener('keydown', handleKeyDown, true)
    document.addEventListener('mousedown', handleClickOutside, true)
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true)
      document.removeEventListener('mousedown', handleClickOutside, true)
    }
  }, [onDismiss])

  return (
    <div
      ref={popupRef}
      className={styles.popup}
      style={{ top: position.top, left: position.left }}
      onMouseDown={(e) => e.preventDefault()}
    >
      <span className={styles.label}>Paste as</span>
      <button className={styles.btn} onClick={onPasteAsText}>Text</button>
      <button className={styles.btnAccent} onClick={onPasteAsBookmark}>Bookmark</button>
    </div>
  )
}
