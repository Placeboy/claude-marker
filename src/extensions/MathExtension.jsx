import { Node, mergeAttributes } from '@tiptap/core'
import { NodeViewWrapper, ReactNodeViewRenderer } from '@tiptap/react'
import { useState, useEffect, useRef, useCallback } from 'react'
import katex from 'katex'
import 'katex/dist/katex.min.css'

function renderKatex(formula, container, displayMode) {
  if (!formula) {
    container.innerHTML = `<span style="color:var(--color-text-tertiary);font-style:italic">${displayMode ? 'Click to add formula' : '?'}</span>`
    return
  }
  try {
    katex.render(formula, container, { throwOnError: false, displayMode })
  } catch {
    container.textContent = formula
  }
}

function escapeAttrVal(s) {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// ─── Inline Math Node View ────────────────────────────────────────────────────

function InlineMathView({ node, updateAttributes, editor, getPos }) {
  const [editing, setEditing] = useState(!node.attrs.formula)
  const inputRef = useRef(null)
  const renderedRef = useRef(null)

  useEffect(() => {
    if (!editing && renderedRef.current) {
      renderKatex(node.attrs.formula, renderedRef.current, false)
    }
  }, [editing, node.attrs.formula])

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editing])

  const commit = useCallback((value) => {
    const trimmed = value.trim()
    if (trimmed) {
      updateAttributes({ formula: trimmed })
      setEditing(false)
    } else if (!node.attrs.formula) {
      setTimeout(() => {
        const pos = getPos()
        if (pos !== undefined) {
          editor.chain().focus().deleteRange({ from: pos, to: pos + node.nodeSize }).run()
        }
      }, 0)
    } else {
      setEditing(false)
    }
  }, [updateAttributes, editor, getPos, node])

  if (editing) {
    return (
      <NodeViewWrapper as="span" className="math-inline-editing">
        <span className="math-delim">$</span>
        <input
          ref={inputRef}
          className="math-input"
          defaultValue={node.attrs.formula}
          onBlur={(e) => commit(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === 'Escape') {
              e.preventDefault()
              commit(e.target.value)
            }
          }}
        />
        <span className="math-delim">$</span>
      </NodeViewWrapper>
    )
  }

  return (
    <NodeViewWrapper as="span" className="math-inline" onClick={() => setEditing(true)} title="Click to edit formula">
      <span ref={renderedRef} />
    </NodeViewWrapper>
  )
}

// ─── Block Math Node View ─────────────────────────────────────────────────────

function BlockMathView({ node, updateAttributes, editor, getPos }) {
  const [editing, setEditing] = useState(!node.attrs.formula)
  const textareaRef = useRef(null)
  const renderedRef = useRef(null)

  useEffect(() => {
    if (!editing && renderedRef.current) {
      renderKatex(node.attrs.formula, renderedRef.current, true)
    }
  }, [editing, node.attrs.formula])

  useEffect(() => {
    if (editing && textareaRef.current) {
      const ta = textareaRef.current
      ta.focus()
      ta.select()
      ta.style.height = 'auto'
      ta.style.height = ta.scrollHeight + 'px'
    }
  }, [editing])

  const commit = useCallback((value) => {
    const trimmed = value.trim()
    if (trimmed) {
      updateAttributes({ formula: trimmed })
      setEditing(false)
    } else if (!node.attrs.formula) {
      setTimeout(() => {
        const pos = getPos()
        if (pos !== undefined) {
          editor.chain().focus().deleteRange({ from: pos, to: pos + node.nodeSize }).run()
        }
      }, 0)
    } else {
      setEditing(false)
    }
  }, [updateAttributes, editor, getPos, node])

  if (editing) {
    return (
      <NodeViewWrapper className="math-block-editing">
        <div className="math-delim">$$</div>
        <textarea
          ref={textareaRef}
          className="math-textarea"
          defaultValue={node.attrs.formula}
          placeholder="Enter LaTeX formula…"
          onBlur={(e) => commit(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault()
              commit(e.target.value)
            }
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault()
              commit(e.target.value)
            }
            requestAnimationFrame(() => {
              const ta = e.target
              ta.style.height = 'auto'
              ta.style.height = ta.scrollHeight + 'px'
            })
          }}
        />
        <div className="math-delim math-delim-hint">Cmd/Ctrl+Enter to render · Escape to cancel</div>
      </NodeViewWrapper>
    )
  }

  return (
    <NodeViewWrapper className="math-block" onClick={() => setEditing(true)} title="Click to edit formula">
      <div ref={renderedRef} />
    </NodeViewWrapper>
  )
}

// ─── TipTap Extensions ────────────────────────────────────────────────────────

export const InlineMath = Node.create({
  name: 'inlineMath',
  group: 'inline',
  inline: true,
  atom: true,

  addAttributes() {
    return {
      formula: {
        default: '',
        parseHTML: (el) => el.getAttribute('data-formula') || '',
      },
    }
  },

  parseHTML() {
    return [{ tag: 'span[data-type="inline-math"]' }]
  },

  renderHTML({ node }) {
    return ['span', mergeAttributes({ 'data-type': 'inline-math', 'data-formula': node.attrs.formula })]
  },

  addNodeView() {
    return ReactNodeViewRenderer(InlineMathView)
  },
})

export const BlockMath = Node.create({
  name: 'blockMath',
  group: 'block',
  atom: true,

  addAttributes() {
    return {
      formula: {
        default: '',
        parseHTML: (el) => el.getAttribute('data-formula') || '',
      },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-type="block-math"]' }]
  },

  renderHTML({ node }) {
    return ['div', mergeAttributes({ 'data-type': 'block-math', 'data-formula': node.attrs.formula })]
  },

  addNodeView() {
    return ReactNodeViewRenderer(BlockMathView)
  },
})

export { escapeAttrVal }
