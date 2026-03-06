import { useEffect, useRef, useState, useCallback } from 'react'
import { openExternal } from '../../utils/tauriAdapter'
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
import ImageLightbox from '../ImageLightbox/ImageLightbox.jsx'
import styles from './Editor.module.css'

const lowlight = createLowlight(common)

function resolveNotionAttachments(html, notionDataStr, pageSourceStr) {
  try {
    const attachmentMap = new Map()
    let fallbackSpaceId = null
    let fallbackBlockId = null

    // Primary: extract per-image proxy URLs from block metadata
    if (notionDataStr) {
      const notionData = JSON.parse(notionDataStr)
      for (const block of notionData.blocks || []) {
        const subtree = block.blockSubtree?.block || {}
        for (const [blockId, blockData] of Object.entries(subtree)) {
          const value = blockData.value
          if (!value) continue
          if (value.space_id && !fallbackSpaceId) fallbackSpaceId = value.space_id
          if (value.type !== 'image') continue
          const source = value.format?.display_source
            || value.properties?.source?.[0]?.[0]
          if (!source || !source.startsWith('attachment:')) continue
          const spaceId = value.space_id
          const proxyUrl = `https://www.notion.so/image/${encodeURIComponent(source)}`
            + `?table=block&id=${blockId}&spaceId=${spaceId}`
          attachmentMap.set(source, proxyUrl)
        }
      }
    }

    // Fallback: page-level spaceId + pageId for any remaining attachment: images
    if (pageSourceStr) {
      try {
        const ps = JSON.parse(pageSourceStr)
        if (!fallbackSpaceId) fallbackSpaceId = ps.spaceId
        fallbackBlockId = ps.id
      } catch {}
    }

    const parsed = new DOMParser().parseFromString(html, 'text/html')
    parsed.querySelectorAll('img[src^="attachment:"]').forEach((img) => {
      const src = img.getAttribute('src')
      if (attachmentMap.has(src)) {
        img.setAttribute('src', attachmentMap.get(src))
      } else if (fallbackSpaceId && fallbackBlockId) {
        img.setAttribute('src',
          `https://www.notion.so/image/${encodeURIComponent(src)}`
          + `?table=block&id=${fallbackBlockId}&spaceId=${fallbackSpaceId}`)
      }
    })

    // Unwrap <img> from <p> wrappers so block-level images don't leave empty paragraphs
    parsed.querySelectorAll('p > img:only-child').forEach((img) => {
      img.parentElement.replaceWith(img)
    })

    return parsed.body.innerHTML
  } catch {
    return html
  }
}

async function localizeDocumentImages(editor) {
  if (!editor) return

  // Collect unique non-local image srcs
  const srcs = new Set()
  editor.state.doc.descendants((node) => {
    if (node.type.name === 'image' && node.attrs.src && !node.attrs['data-image-id']) {
      srcs.add(node.attrs.src)
    }
  })
  if (!srcs.size) return

  // Fetch all images in parallel — fetch() handles both https:// and data: URIs
  const srcMap = new Map()
  await Promise.allSettled(
    Array.from(srcs).map(async (src) => {
      try {
        const resp = await fetch(src)
        if (!resp.ok) return
        const blob = await resp.blob()
        if (!blob.size) return
        const id = await saveImage(blob)
        const url = await getImageUrl(id)
        srcMap.set(src, { url, id })
      } catch {
        // Skip images that can't be fetched (e.g. CORS)
      }
    })
  )
  if (!srcMap.size) return

  // Apply all changes in a single transaction on the current document state
  const { tr } = editor.state
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name === 'image' && srcMap.has(node.attrs.src)) {
      const { url, id } = srcMap.get(node.attrs.src)
      tr.setNodeMarkup(pos, undefined, {
        ...node.attrs,
        src: url,
        'data-image-id': id,
      })
    }
  })
  if (tr.docChanged) {
    editor.view.dispatch(tr)
  }
}

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
  const [lightboxSrc, setLightboxSrc] = useState(null)

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
        allowBase64: true,
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
          if (href && href.startsWith('#') && href.length > 1) {
            window.dispatchEvent(new CustomEvent('navigate-doc', { detail: { docId: href.slice(1) } }))
          } else if (href) {
            openExternal(href)
          }
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

        // Notion paste: resolve attachment: URIs to Notion image proxy URLs
        const notionData = event.clipboardData?.getData('text/_notion-blocks-v3-production')
        const pageSource = event.clipboardData?.getData('text/_notion-page-source-production')
        const html = event.clipboardData?.getData('text/html')
        if ((notionData || pageSource) && html && /attachment:/.test(html)) {
          event.preventDefault()
          const fixedHtml = resolveNotionAttachments(html, notionData, pageSource)
          editorRef.current?.commands.insertContent(fixedHtml)
          setTimeout(() => localizeDocumentImages(editorRef.current), 0)
          return true
        }

        // Rich HTML paste with images (e.g. from web pages):
        // let ProseMirror handle natively, then localize in the background.
        if (html && /<img\b/i.test(html)) {
          setTimeout(() => localizeDocumentImages(editorRef.current), 0)
          return false
        }

        // Direct image file paste (e.g. screenshot) — only when there's no
        // HTML context, otherwise the rich content handler above takes priority.
        const items = Array.from(event.clipboardData?.items || [])
        const imageItem = items.find((item) => item.type.startsWith('image/'))
        if (imageItem) {
          event.preventDefault()
          const file = imageItem.getAsFile()
          if (file && editorRef.current) insertImage(file, editorRef.current)
          return true
        }

        return false
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

  useEffect(() => {
    const handleLightbox = (e) => setLightboxSrc(e.detail.src)
    window.addEventListener('image-lightbox', handleLightbox)
    return () => window.removeEventListener('image-lightbox', handleLightbox)
  }, [])

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
      {lightboxSrc && (
        <ImageLightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />
      )}
    </div>
  )
}
