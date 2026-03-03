import { useState, useEffect, useCallback, useRef } from 'react'

const DEBOUNCE_MS = 300

export default function useToc(editor) {
  const [headings, setHeadings] = useState([])
  const [activeId, setActiveId] = useState(null)
  const composingRef = useRef(false)
  const timerRef = useRef(null)

  const extractHeadings = useCallback(() => {
    if (!editor) return

    const items = []
    const { doc } = editor.state

    doc.descendants((node, pos) => {
      if (node.type.name === 'heading') {
        const id = `heading-${pos}`
        items.push({
          id,
          level: node.attrs.level,
          text: node.textContent,
          pos,
        })
      }
    })

    setHeadings(items)
  }, [editor])

  // Debounced extract that skips during IME composition
  const debouncedExtract = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
    }
    timerRef.current = setTimeout(() => {
      if (!composingRef.current) {
        extractHeadings()
      }
    }, DEBOUNCE_MS)
  }, [extractHeadings])

  // Track IME composition state
  useEffect(() => {
    if (!editor) return

    const dom = editor.view.dom

    const onStart = () => { composingRef.current = true }
    const onEnd = () => {
      composingRef.current = false
      // Extract after composition ends
      extractHeadings()
    }

    dom.addEventListener('compositionstart', onStart)
    dom.addEventListener('compositionend', onEnd)

    return () => {
      dom.removeEventListener('compositionstart', onStart)
      dom.removeEventListener('compositionend', onEnd)
    }
  }, [editor, extractHeadings])

  // Update headings when content changes (debounced)
  useEffect(() => {
    if (!editor) return

    extractHeadings()

    editor.on('update', debouncedExtract)
    return () => {
      editor.off('update', debouncedExtract)
      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }
    }
  }, [editor, extractHeadings, debouncedExtract])

  // Track active heading via scroll position using Intersection Observer
  useEffect(() => {
    if (!editor || headings.length === 0) return

    const editorElement = editor.view.dom

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const id = entry.target.getAttribute('data-toc-id')
            if (id) {
              setActiveId(id)
            }
          }
        }
      },
      {
        root: editorElement.closest('[class*="editorArea"]'),
        rootMargin: '-10% 0px -80% 0px',
        threshold: 0,
      }
    )

    const headingElements = editorElement.querySelectorAll('h1, h2, h3')
    let headingIndex = 0
    headingElements.forEach((el) => {
      if (headingIndex < headings.length) {
        el.setAttribute('data-toc-id', headings[headingIndex].id)
        observer.observe(el)
        headingIndex++
      }
    })

    return () => observer.disconnect()
  }, [editor, headings])

  return { headings, activeId }
}
