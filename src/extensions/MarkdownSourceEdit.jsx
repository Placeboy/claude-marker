import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { DOMSerializer, DOMParser as ProseDOMParser } from '@tiptap/pm/model'
import { createTurndownService, markdownToHtml } from '../utils/markdown'

const pluginKey = new PluginKey('markdownSourceEdit')

const EXCLUDED_TYPES = new Set(['image', 'bookmark', 'codeBlock'])

function nodeToMarkdown(node, schema) {
  const serializer = DOMSerializer.fromSchema(schema)
  const dom = serializer.serializeNode(node)
  const wrapper = document.createElement('div')
  wrapper.appendChild(dom)
  return createTurndownService().turndown(wrapper.innerHTML)
}

function enterSourceEdit(view, pos, node) {
  const editorDOM = view.dom // .tiptap element
  const container = editorDOM.parentElement
  if (!container) return

  // Find the DOM element for this block node
  const nodeDOM = view.nodeDOM(pos)
  if (!nodeDOM || !(nodeDOM instanceof HTMLElement)) return

  // Calculate position relative to container
  const containerRect = container.getBoundingClientRect()
  const nodeRect = nodeDOM.getBoundingClientRect()

  const markdown = nodeToMarkdown(node, view.state.schema)

  // Create wrapper
  const wrapper = document.createElement('div')
  wrapper.className = 'markdown-source-edit-wrapper'
  wrapper.style.top = `${nodeRect.top - containerRect.top}px`
  wrapper.style.left = `${nodeRect.left - containerRect.left}px`
  wrapper.style.width = `${nodeRect.width}px`

  // Create textarea
  const textarea = document.createElement('textarea')
  textarea.className = 'markdown-source-edit'
  textarea.value = markdown
  textarea.style.padding = window.getComputedStyle(nodeDOM).padding || '0'
  wrapper.appendChild(textarea)

  container.style.position = 'relative'
  container.appendChild(wrapper)

  // Auto-size textarea to fit content
  const autoResize = () => {
    textarea.style.height = 'auto'
    textarea.style.height = `${textarea.scrollHeight}px`
  }

  // Dim the original block
  nodeDOM.style.opacity = '0'

  textarea.addEventListener('input', autoResize)

  // Set initial height after inserting into DOM
  requestAnimationFrame(() => {
    // Ensure minimum height matches original block
    textarea.style.height = `${Math.max(textarea.scrollHeight, nodeRect.height)}px`
    textarea.focus()
  })

  // pos is already the start of the block node; use nodeSize for the end
  const blockStart = pos
  const blockEnd = pos + node.nodeSize
  let exited = false

  const exitSourceEdit = () => {
    if (exited) return
    exited = true

    textarea.removeEventListener('blur', onBlur)
    textarea.removeEventListener('keydown', onKeyDown)
    textarea.removeEventListener('input', autoResize)

    const newMarkdown = textarea.value.trim()
    wrapper.remove()

    // Restore original block visibility
    nodeDOM.style.opacity = ''

    if (!newMarkdown) {
      // Empty content — delete the block
      const tr = view.state.tr
      tr.delete(blockStart, blockEnd)
      view.dispatch(tr)
      view.focus()
      return
    }

    // Convert markdown back to HTML, then to ProseMirror nodes
    const html = markdownToHtml(newMarkdown)
    const tempDiv = document.createElement('div')
    tempDiv.innerHTML = html

    const parsed = ProseDOMParser.fromSchema(view.state.schema).parse(tempDiv)

    // Replace with all top-level nodes from parsed content
    const tr = view.state.tr
    const nodes = []
    parsed.content.forEach((n) => nodes.push(n))
    tr.replaceWith(blockStart, blockEnd, nodes)
    view.dispatch(tr)
    view.focus()
  }

  const onBlur = () => {
    // Small delay to allow click events to process first
    setTimeout(exitSourceEdit, 0)
  }

  const onKeyDown = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      exitSourceEdit()
    }
    // Allow Tab to insert actual tab character
    if (e.key === 'Tab') {
      e.preventDefault()
      const start = textarea.selectionStart
      const end = textarea.selectionEnd
      textarea.value = textarea.value.substring(0, start) + '\t' + textarea.value.substring(end)
      textarea.selectionStart = textarea.selectionEnd = start + 1
      textarea.dispatchEvent(new Event('input'))
    }
  }

  textarea.addEventListener('blur', onBlur)
  textarea.addEventListener('keydown', onKeyDown)
}

const MarkdownSourceEdit = Extension.create({
  name: 'markdownSourceEdit',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: pluginKey,
        props: {
          handleDoubleClick(view, pos, event) {
            // Don't activate if there's already an active source edit
            if (view.dom.parentElement?.querySelector('.markdown-source-edit-wrapper')) {
              return false
            }

            const $pos = view.state.doc.resolve(pos)
            // Walk up to find the top-level block node (depth 1)
            if ($pos.depth < 1) return false

            const blockPos = $pos.before(1)
            const blockNode = view.state.doc.nodeAt(blockPos)
            if (!blockNode) return false

            // Skip excluded types
            if (EXCLUDED_TYPES.has(blockNode.type.name)) return false

            enterSourceEdit(view, blockPos, blockNode)
            return true
          },
        },
      }),
    ]
  },
})

export default MarkdownSourceEdit
