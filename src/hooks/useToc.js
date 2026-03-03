import { useState, useEffect, useCallback } from 'react'

export default function useToc(editor) {
  const [headings, setHeadings] = useState([])
  const [activeId, setActiveId] = useState(null)

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

  // Update headings when content changes
  useEffect(() => {
    if (!editor) return

    extractHeadings()

    editor.on('update', extractHeadings)
    return () => {
      editor.off('update', extractHeadings)
    }
  }, [editor, extractHeadings])

  // Track active heading via scroll position using Intersection Observer
  useEffect(() => {
    if (!editor || headings.length === 0) return

    const editorElement = editor.view.dom

    const observer = new IntersectionObserver(
      (entries) => {
        // Find the first heading that is intersecting
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

    // Add data attributes to heading elements and observe them
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
