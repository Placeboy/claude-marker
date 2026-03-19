import { Extension } from '@tiptap/core'
import { PluginKey } from '@tiptap/pm/state'
import Suggestion from '@tiptap/suggestion'
import { createRoot } from 'react-dom/client'
import SlashMenu from '../components/SlashMenu/SlashMenu'

export const slashItems = [
  {
    title: 'Heading 1',
    description: 'Large section heading',
    icon: 'H1',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setNode('heading', { level: 1 }).run()
    },
  },
  {
    title: 'Heading 2',
    description: 'Medium section heading',
    icon: 'H2',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setNode('heading', { level: 2 }).run()
    },
  },
  {
    title: 'Heading 3',
    description: 'Small section heading',
    icon: 'H3',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setNode('heading', { level: 3 }).run()
    },
  },
  {
    title: 'Bullet List',
    description: 'Unordered list',
    icon: '•',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleBulletList().run()
    },
  },
  {
    title: 'Numbered List',
    description: 'Ordered list',
    icon: '1.',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleOrderedList().run()
    },
  },
  {
    title: 'Task List',
    description: 'Checklist with to-dos',
    icon: '☑',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleTaskList().run()
    },
  },
  {
    title: 'Quote',
    description: 'Block quotation',
    icon: '"',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleBlockquote().run()
    },
  },
  {
    title: 'Code Block',
    description: 'Code with syntax highlighting',
    icon: '<>',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleCodeBlock().run()
    },
  },
  {
    title: 'Divider',
    description: 'Horizontal rule',
    icon: '—',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setHorizontalRule().run()
    },
  },
  {
    title: 'Image',
    description: 'Insert image from URL',
    icon: '🖼',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).run()
      const url = window.prompt('Enter image URL:', 'https://')
      if (!url || url === 'https://') return
      editor.chain().focus().setImage({ src: url }).run()
    },
  },
  {
    title: 'Table',
    description: 'Insert a table',
    icon: '⊞',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
    },
  },
  {
    title: 'Bookmark',
    description: 'Embed a link as a card',
    icon: '🔖',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).run()
      const url = window.prompt('Enter URL:', 'https://')
      if (!url || url === 'https://') return
      editor.chain().focus().setBookmark(url).run()
    },
  },
]

const SlashCommandPluginKey = new PluginKey('slashCommand')

const SlashCommand = Extension.create({
  name: 'slashCommand',

  addOptions() {
    return {
      suggestion: {
        char: '/',
        pluginKey: SlashCommandPluginKey,
        command: ({ editor, range, props }) => {
          props.command({ editor, range })
        },
        items: ({ query }) => {
          return slashItems.filter((item) =>
            item.title.toLowerCase().includes(query.toLowerCase())
          )
        },
        render: () => {
          let container
          let root
          let component

          return {
            onStart: (props) => {
              container = document.createElement('div')
              container.style.position = 'absolute'
              container.style.zIndex = '1000'
              document.body.appendChild(container)
              root = createRoot(container)
              component = { props }

              updatePosition(container, props)
              root.render(
                <SlashMenu
                  items={props.items}
                  command={props.command}
                />
              )
            },
            onUpdate: (props) => {
              component.props = props
              updatePosition(container, props)
              root.render(
                <SlashMenu
                  items={props.items}
                  command={props.command}
                />
              )
            },
            onKeyDown: ({ event }) => {
              if (event.key === 'Escape') {
                return true
              }
              // Let the menu handle arrow keys and enter
              if (['ArrowUp', 'ArrowDown', 'Enter'].includes(event.key)) {
                const menuEvent = new CustomEvent('slash-menu-keydown', {
                  detail: { key: event.key },
                })
                document.dispatchEvent(menuEvent)
                return true
              }
              return false
            },
            onExit: () => {
              if (root) root.unmount()
              if (container && container.parentNode) {
                container.parentNode.removeChild(container)
              }
            },
          }
        },
      },
    }
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...this.options.suggestion,
      }),
    ]
  },
})

function updatePosition(container, props) {
  const { clientRect } = props
  if (!clientRect) return
  const rect = clientRect()
  if (!rect) return
  container.style.left = `${rect.left}px`
  container.style.top = `${rect.bottom + 4}px`
}

export default SlashCommand
