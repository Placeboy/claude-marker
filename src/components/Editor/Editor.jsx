import { useEffect } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Highlight from '@tiptap/extension-highlight'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import Underline from '@tiptap/extension-underline'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
import { common, createLowlight } from 'lowlight'
import SlashCommand from '../../extensions/SlashCommand.jsx'
import styles from './Editor.module.css'

const lowlight = createLowlight(common)

const STORAGE_KEY = 'markdown-editor-content'

function getInitialContent() {
  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved) {
    try {
      return JSON.parse(saved)
    } catch {
      return null
    }
  }
  return {
    type: 'doc',
    content: [
      {
        type: 'heading',
        attrs: { level: 1 },
        content: [{ type: 'text', text: 'Welcome to Markdown Editor' }],
      },
      {
        type: 'paragraph',
        content: [
          { type: 'text', text: 'Start typing, or press ' },
          { type: 'text', marks: [{ type: 'code' }], text: '/' },
          { type: 'text', text: ' for commands. Use Markdown shortcuts like ' },
          { type: 'text', marks: [{ type: 'code' }], text: '# ' },
          { type: 'text', text: ' for headings, ' },
          { type: 'text', marks: [{ type: 'code' }], text: '- ' },
          { type: 'text', text: ' for lists, and ' },
          { type: 'text', marks: [{ type: 'code' }], text: '> ' },
          { type: 'text', text: ' for quotes.' },
        ],
      },
    ],
  }
}

export default function Editor({ onReady }) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: false,
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Highlight.configure({
        multicolor: false,
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          rel: 'noopener noreferrer',
          target: '_blank',
        },
      }),
      Underline,
      Placeholder.configure({
        placeholder: 'Type \'/\' for commands, or start writing...',
      }),
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
      CodeBlockLowlight.configure({
        lowlight,
      }),
      SlashCommand,
    ],
    content: getInitialContent(),
    editorProps: {
      attributes: {
        spellcheck: 'false',
      },
    },
  })

  useEffect(() => {
    if (editor) {
      onReady(editor)

      // Add keyboard shortcut for highlight
      const handleKeyDown = (e) => {
        if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'h') {
          e.preventDefault()
          editor.chain().focus().toggleHighlight().run()
        }
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
          e.preventDefault()
          const previousUrl = editor.getAttributes('link').href
          const url = window.prompt('Enter URL:', previousUrl || 'https://')
          if (url === null) return
          if (url === '') {
            editor.chain().focus().extendMarkRange('link').unsetLink().run()
            return
          }
          editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
        }
      }

      document.addEventListener('keydown', handleKeyDown)
      return () => document.removeEventListener('keydown', handleKeyDown)
    }
  }, [editor, onReady])

  return (
    <div className={styles.editor}>
      <EditorContent editor={editor} />
    </div>
  )
}
