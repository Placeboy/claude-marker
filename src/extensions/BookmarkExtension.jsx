import { Node, mergeAttributes } from '@tiptap/core'

const BookmarkExtension = Node.create({
  name: 'bookmark',
  group: 'block',
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      url: { default: '' },
      title: { default: '' },
      description: { default: '' },
      icon: { default: '' },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="bookmark"]',
        getAttrs: (dom) => ({
          url: dom.getAttribute('data-url') || '',
          title: dom.getAttribute('data-title') || '',
          description: dom.getAttribute('data-description') || '',
          icon: dom.getAttribute('data-icon') || '',
        }),
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes({
      'data-type': 'bookmark',
      'data-url': HTMLAttributes.url,
      'data-title': HTMLAttributes.title,
      'data-description': HTMLAttributes.description,
      'data-icon': HTMLAttributes.icon,
    })]
  },

  addCommands() {
    return {
      setBookmark: (url) => ({ tr, dispatch, editor }) => {
        if (!url) return false

        let hostname
        try {
          hostname = new URL(url).hostname
        } catch {
          hostname = url
        }

        const faviconUrl = `https://www.google.com/s2/favicons?domain=${hostname}&sz=32`

        const node = this.type.create({
          url,
          title: hostname,
          description: '',
          icon: faviconUrl,
        })

        if (dispatch) {
          const { from, to } = tr.selection
          tr.replaceRangeWith(from, to, node)
        }

        // Async fetch metadata
        fetch(`https://api.microlink.io/?url=${encodeURIComponent(url)}`)
          .then((res) => res.json())
          .then((data) => {
            if (data.status === 'success' && data.data) {
              const { title, description, logo } = data.data
              // Find the bookmark node in current doc
              const { doc } = editor.state
              doc.descendants((n, pos) => {
                if (n.type.name === 'bookmark' && n.attrs.url === url) {
                  const attrs = {}
                  if (title) attrs.title = title
                  if (description) attrs.description = description
                  if (logo?.url) attrs.icon = logo.url
                  if (Object.keys(attrs).length > 0) {
                    editor.chain().command(({ tr: t }) => {
                      t.setNodeMarkup(pos, undefined, { ...n.attrs, ...attrs })
                      return true
                    }).run()
                  }
                }
              })
            }
          })
          .catch(() => {
            // Keep hostname as title — no-op on failure
          })

        return true
      },
    }
  },

  addNodeView() {
    return ({ node, editor, getPos }) => {
      const wrapper = document.createElement('div')
      wrapper.className = 'bookmark-card'

      const content = document.createElement('div')
      content.className = 'bookmark-content'

      const titleEl = document.createElement('div')
      titleEl.className = 'bookmark-title'
      titleEl.textContent = node.attrs.title || ''

      const descEl = document.createElement('div')
      descEl.className = 'bookmark-description'
      descEl.textContent = node.attrs.description || ''

      const urlRow = document.createElement('div')
      urlRow.className = 'bookmark-url'

      const iconEl = document.createElement('img')
      iconEl.className = 'bookmark-icon'
      iconEl.src = node.attrs.icon || ''
      iconEl.width = 16
      iconEl.height = 16
      iconEl.onerror = () => { iconEl.style.display = 'none' }

      let hostname
      try {
        hostname = new URL(node.attrs.url).hostname
      } catch {
        hostname = node.attrs.url
      }
      const urlText = document.createElement('span')
      urlText.textContent = hostname

      urlRow.appendChild(iconEl)
      urlRow.appendChild(urlText)

      content.appendChild(titleEl)
      content.appendChild(descEl)
      content.appendChild(urlRow)
      wrapper.appendChild(content)

      // Click opens the link; selection via keyboard
      wrapper.addEventListener('click', (e) => {
        e.preventDefault()
        window.open(node.attrs.url, '_blank', 'noopener,noreferrer')
      })

      return {
        dom: wrapper,
        contentDOM: null,

        stopEvent(event) {
          if (event.type === 'mousedown') return true
          return false
        },

        ignoreMutation() {
          return true
        },

        update(updatedNode) {
          if (updatedNode.type.name !== 'bookmark') return false
          titleEl.textContent = updatedNode.attrs.title || ''
          descEl.textContent = updatedNode.attrs.description || ''
          if (updatedNode.attrs.icon) {
            iconEl.src = updatedNode.attrs.icon
            iconEl.style.display = ''
          }
          try {
            urlText.textContent = new URL(updatedNode.attrs.url).hostname
          } catch {
            urlText.textContent = updatedNode.attrs.url
          }
          return true
        },

        selectNode() {
          wrapper.classList.add('ProseMirror-selectednode')
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

export default BookmarkExtension
