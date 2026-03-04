import Image from '@tiptap/extension-image'

const ImageExtension = Image.extend({
  draggable: true,

  addAttributes() {
    return {
      ...this.parent?.(),
      'data-image-id': {
        default: null,
        parseHTML: (element) => element.getAttribute('data-image-id'),
        renderHTML: (attributes) => {
          if (!attributes['data-image-id']) return {}
          return { 'data-image-id': attributes['data-image-id'] }
        },
      },
      width: {
        default: null,
        parseHTML: (element) => {
          return element.getAttribute('width') || element.style.width || null
        },
        renderHTML: (attributes) => {
          if (!attributes.width) return {}
          return { width: attributes.width }
        },
      },
    }
  },

  addNodeView() {
    return ({ node, editor, getPos }) => {
      const wrapper = document.createElement('div')
      wrapper.classList.add('image-resizable')

      const img = document.createElement('img')
      img.src = node.attrs.src
      img.alt = node.attrs.alt || ''
      if (node.attrs.title) img.title = node.attrs.title
      if (node.attrs['data-image-id']) {
        img.setAttribute('data-image-id', node.attrs['data-image-id'])
      }
      if (node.attrs.width) img.style.width = node.attrs.width
      img.draggable = false
      wrapper.appendChild(img)

      // Left / right edge handles
      for (const side of ['left', 'right']) {
        const handle = document.createElement('div')
        handle.className = `image-edge-handle image-edge-handle-${side}`
        handle.addEventListener('mousedown', startResize(side))
        wrapper.appendChild(handle)
      }

      // ---- Selection on mousedown ----
      wrapper.addEventListener('mousedown', (e) => {
        if (e.target.classList.contains('image-edge-handle')) return
        const pos = getPos()
        if (pos == null) return
        editor.commands.setNodeSelection(pos)
      })

      // Click away anywhere else → deselect is handled by ProseMirror automatically
      // when the user clicks outside this node.

      // ---- Resize ----
      let resizing = false

      function startResize(side) {
        return (e) => {
          e.preventDefault()
          e.stopPropagation()
          resizing = true

          const nodePos = getPos()
          if (nodePos != null) editor.commands.setNodeSelection(nodePos)

          const startX = e.clientX
          const startWidth = img.offsetWidth
          const growsLeft = side === 'left'

          document.body.style.userSelect = 'none'
          document.body.style.webkitUserSelect = 'none'
          document.body.style.cursor = 'col-resize'

          const onMove = (ev) => {
            const diff = ev.clientX - startX
            const delta = growsLeft ? -diff : diff
            const newWidth = Math.max(60, startWidth + delta)
            img.style.width = newWidth + 'px'
          }

          const onUp = () => {
            document.removeEventListener('mousemove', onMove)
            document.removeEventListener('mouseup', onUp)
            document.body.style.userSelect = ''
            document.body.style.webkitUserSelect = ''
            document.body.style.cursor = ''
            resizing = false

            const pos = getPos()
            if (pos == null) return
            editor.chain()
              .setNodeSelection(pos)
              .updateAttributes('image', { width: img.style.width })
              .run()
          }

          document.addEventListener('mousemove', onMove)
          document.addEventListener('mouseup', onUp)
        }
      }

      return {
        dom: wrapper,
        contentDOM: null,

        // KEY FIX: block mousedown from ProseMirror so it can't override
        // our NodeSelection with a TextSelection. Allow dragstart through
        // so ProseMirror can handle node dragging once the node is selected.
        stopEvent(event) {
          if (event.type === 'mousedown') return true
          if (resizing) return true
          return false
        },

        ignoreMutation() {
          return true
        },

        update(updatedNode) {
          if (updatedNode.type.name !== 'image') return false
          img.src = updatedNode.attrs.src
          img.alt = updatedNode.attrs.alt || ''
          if (updatedNode.attrs.title) img.title = updatedNode.attrs.title
          else img.removeAttribute('title')
          if (updatedNode.attrs['data-image-id']) {
            img.setAttribute('data-image-id', updatedNode.attrs['data-image-id'])
          } else {
            img.removeAttribute('data-image-id')
          }
          img.style.width = updatedNode.attrs.width || ''
          return true
        },

        selectNode() {
          wrapper.classList.add('ProseMirror-selectednode')
          // Enable native drag so ProseMirror's dragstart can move the node
          wrapper.draggable = true
        },

        deselectNode() {
          wrapper.classList.remove('ProseMirror-selectednode')
          wrapper.draggable = false
        },

        destroy() {},
      }
    }
  },
})

export default ImageExtension
