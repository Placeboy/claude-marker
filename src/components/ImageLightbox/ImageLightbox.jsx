import { useState, useEffect, useCallback } from 'react'
import styles from './ImageLightbox.module.css'

export default function ImageLightbox({ src, onClose }) {
  const [zoom, setZoom] = useState(1)

  useEffect(() => {
    setZoom(1)
  }, [src])

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  const handleWheel = useCallback((e) => {
    e.preventDefault()
    setZoom((z) => {
      const delta = e.deltaY < 0 ? 0.1 : -0.1
      return Math.min(5, Math.max(0.1, z + delta))
    })
  }, [])

  return (
    <div className={styles.overlay} onClick={onClose} onWheel={handleWheel}>
      <img
        className={styles.image}
        src={src}
        style={{ transform: `scale(${zoom})` }}
        onClick={(e) => e.stopPropagation()}
        draggable={false}
      />
    </div>
  )
}
