import { useEffect, useRef, useState, useCallback } from 'react'
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
import ImageExtension from '../../extensions/ImageExtension.jsx'
import BookmarkExtension from '../../extensions/BookmarkExtension.jsx'
import { saveImage, getImageUrl } from '../../utils/imageStore.js'
import LinkPopup from '../LinkPopup/LinkPopup.jsx'
import PasteBookmarkPopup from '../PasteBookmarkPopup/PasteBookmarkPopup.jsx'
import styles from './Editor.module.css'

const lowlight = createLowlight(common)

async function insertImage(file, editor, pos) {
  const id = await saveImage(file)
  const url = await getImageUrl(id)
  if (pos != null) {
    editor.chain().focus().insertContentAt(pos, {
      type: 'image',
      attrs: { src: url, 'data-image-id': id },
    }).run()
  } else {
    editor.chain().focus().setImage({ src: url, 'data-image-id': id }).run()
  }
}

const URL_REGEX = /^https?:\/\/\S+$/

export default function Editor({ onReady }) {
  const editorRef = useRef(null)
  const [pastePopup, setPastePopup] = useState(null)

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
      ImageExtension.configure({
        inline: false,
        allowBase64: false,
      }),
      BookmarkExtension,
    ],
    content: { type: 'doc', content: [{ type: 'paragraph' }] },
    editorProps: {
      attributes: {
        spellcheck: 'false',
      },
      handleDOMEvents: {
        mousedown: (view, event) => {
          const anchor = event.target.closest?.('a')
          if (!anchor) return false
          event.preventDefault()
          const href = anchor.getAttribute('href')
          if (href) window.open(href, '_blank', 'noopener,noreferrer')
          return true
        },
      },
      handlePaste: (view, event) => {
        // Detect bare URL paste
        const text = event.clipboardData?.getData('text/plain')?.trim()
        if (text && URL_REGEX.test(text)) {
          event.preventDefault()
          const coords = view.coordsAtPos(view.state.selection.from)
          setPastePopup({
            url: text,
            position: { top: coords.bottom + 4, left: coords.left },
          })
          return true
        }

        const items = Array.from(event.clipboardData?.items || [])
        const imageItem = items.find((item) => item.type.startsWith('image/'))
        if (!imageItem) return false
        event.preventDefault()
        const file = imageItem.getAsFile()
        if (file && editorRef.current) insertImage(file, editorRef.current)
        return true
      },
      handleDrop: (view, event) => {
        const files = Array.from(event.dataTransfer?.files || [])
        const imageFile = files.find((f) => f.type.startsWith('image/'))
        if (!imageFile) return false
        event.preventDefault()
        const pos = view.posAtCoords({ left: event.clientX, top: event.clientY })
        if (editorRef.current) insertImage(imageFile, editorRef.current, pos?.pos)
        return true
      },
    },
  })

  editorRef.current = editor

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

  const handlePasteAsText = useCallback(() => {
    if (!pastePopup || !editor) return
    editor.chain().focus().insertContent({
      type: 'text',
      text: pastePopup.url,
      marks: [{ type: 'link', attrs: { href: pastePopup.url } }],
    }).run()
    setPastePopup(null)
  }, [pastePopup, editor])

  const handlePasteAsBookmark = useCallback(() => {
    if (!pastePopup || !editor) return
    editor.chain().focus().setBookmark(pastePopup.url).run()
    setPastePopup(null)
  }, [pastePopup, editor])

  const handleDismissPastePopup = useCallback(() => {
    if (!pastePopup || !editor) return
    editor.chain().focus().insertContent({
      type: 'text',
      text: pastePopup.url,
      marks: [{ type: 'link', attrs: { href: pastePopup.url } }],
    }).run()
    setPastePopup(null)
  }, [pastePopup, editor])

  return (
    <div className={styles.editor}>
      <EditorContent editor={editor} />
      <LinkPopup editor={editor} />
      {pastePopup && (
        <PasteBookmarkPopup
          url={pastePopup.url}
          position={pastePopup.position}
          onPasteAsText={handlePasteAsText}
          onPasteAsBookmark={handlePasteAsBookmark}
          onDismiss={handleDismissPastePopup}
        />
      )}
    </div>
  )
}
