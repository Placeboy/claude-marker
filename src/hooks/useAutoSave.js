import { useState, useEffect, useRef } from 'react'

const STORAGE_KEY = 'markdown-editor-content'
const SAVE_DELAY = 1000

export default function useAutoSave(editor) {
  const [lastSaved, setLastSaved] = useState(null)
  const timerRef = useRef(null)

  useEffect(() => {
    if (!editor) return

    const handleUpdate = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }

      timerRef.current = setTimeout(() => {
        const json = editor.getJSON()
        localStorage.setItem(STORAGE_KEY, JSON.stringify(json))
        setLastSaved(new Date())
      }, SAVE_DELAY)
    }

    editor.on('update', handleUpdate)

    return () => {
      editor.off('update', handleUpdate)
      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }
    }
  }, [editor])

  return { lastSaved }
}
