import { useState, useEffect, useCallback } from 'react'
import styles from './SlashMenu.module.css'

export default function SlashMenu({ items, command }) {
  const [selectedIndex, setSelectedIndex] = useState(0)

  useEffect(() => {
    setSelectedIndex(0)
  }, [items])

  const selectItem = useCallback(
    (index) => {
      const item = items[index]
      if (item) {
        command(item)
      }
    },
    [items, command]
  )

  useEffect(() => {
    const handler = (e) => {
      const { key } = e.detail
      if (key === 'ArrowUp') {
        setSelectedIndex((prev) => (prev - 1 + items.length) % items.length)
      } else if (key === 'ArrowDown') {
        setSelectedIndex((prev) => (prev + 1) % items.length)
      } else if (key === 'Enter') {
        selectItem(selectedIndex)
      }
    }
    document.addEventListener('slash-menu-keydown', handler)
    return () => document.removeEventListener('slash-menu-keydown', handler)
  }, [items, selectedIndex, selectItem])

  if (items.length === 0) {
    return (
      <div className={styles.menu}>
        <div className={styles.empty}>No results</div>
      </div>
    )
  }

  return (
    <div className={styles.menu}>
      {items.map((item, index) => (
        <button
          key={item.title}
          className={`${styles.item} ${index === selectedIndex ? styles.selected : ''}`}
          onClick={() => selectItem(index)}
          onMouseEnter={() => setSelectedIndex(index)}
        >
          <span className={styles.icon}>{item.icon}</span>
          <div className={styles.content}>
            <span className={styles.title}>{item.title}</span>
            <span className={styles.description}>{item.description}</span>
          </div>
        </button>
      ))}
    </div>
  )
}
