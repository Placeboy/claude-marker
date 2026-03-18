import { useState, useCallback, useEffect, useRef } from 'react'
import Sidebar from './components/Sidebar/Sidebar'
import TabBar from './components/TabBar/TabBar'
import Toolbar from './components/Toolbar/Toolbar'
import Editor from './components/Editor/Editor'
import SearchBar from './components/SearchBar/SearchBar'
import useToc from './hooks/useToc'
import useDocuments from './hooks/useDocuments'
import useHashRouter from './hooks/useHashRouter'
import { saveTextFile } from './utils/tauriAdapter'
import { editorToMarkdown } from './utils/markdown'
import styles from './App.module.css'

const NATIVE_MENU_EVENT = 'native-menu-action'

export default function App() {
  const [editor, setEditor] = useState(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [searchBarVisible, setSearchBarVisible] = useState(false)
  const [showReplace, setShowReplace] = useState(false)
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('markdown-editor-theme')
    return saved || 'system'
  })
  const menuActionsRef = useRef({
    openFileDialog: async () => {},
    openDirectory: async () => {},
    saveCurrentDoc: async () => {},
    saveCurrentDocAs: async () => {},
    exportMarkdown: async () => {},
  })
  const { headings, activeId } = useToc(editor)
  const { hashDocId, setHash, replaceHash } = useHashRouter()
  const {
    docs,
    visibleTabs,
    treeItems,
    treeEditable,
    currentDocId,
    currentDocName,
    currentDocDeleted,
    currentTreeItemId,
    switchDoc,
    openWorkspaceDoc,
    openFileDialog,
    openDirectory,
    saveCurrentDoc,
    saveCurrentDocAs,
    createDoc,
    createNewFile,
    createFolder,
    deleteItem,
    closeTab,
    moveItem,
    renameDoc,
  } = useDocuments(editor, { hashDocId, setHash, replaceHash })

  useEffect(() => {
    const resolved = theme === 'system'
      ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : theme
    document.documentElement.setAttribute('data-theme', resolved)

    if (theme === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)')
      const handler = (e) => document.documentElement.setAttribute('data-theme', e.matches ? 'dark' : 'light')
      mq.addEventListener('change', handler)
      return () => mq.removeEventListener('change', handler)
    }
  }, [theme])

  const toggleTheme = useCallback(() => {
    setTheme(prev => {
      const next = prev === 'light' ? 'dark' : prev === 'dark' ? 'system' : 'light'
      localStorage.setItem('markdown-editor-theme', next)
      return next
    })
  }, [])

  const handleEditorReady = useCallback((editorInstance) => {
    setEditor(editorInstance)
  }, [])

  const handleExportMarkdown = useCallback(async () => {
    if (!editor) return
    const markdown = editorToMarkdown(editor)
    const fileName = `${currentDocName || 'document'}.md`
    await saveTextFile(markdown, fileName, 'text/markdown')
  }, [currentDocName, editor])

  useEffect(() => {
    menuActionsRef.current = {
      openFileDialog,
      openDirectory,
      saveCurrentDoc,
      saveCurrentDocAs,
      exportMarkdown: handleExportMarkdown,
    }
  }, [handleExportMarkdown, openDirectory, openFileDialog, saveCurrentDoc, saveCurrentDocAs])

  // Listen for internal #docId link navigation
  useEffect(() => {
    const handleNavigateDoc = (e) => {
      const { docId } = e.detail
      if (docs.find((d) => d.id === docId && d.type === 'doc')) {
        switchDoc(docId)
      }
    }
    window.addEventListener('navigate-doc', handleNavigateDoc)
    return () => window.removeEventListener('navigate-doc', handleNavigateDoc)
  }, [docs, switchDoc])

  useEffect(() => {
    if (!window.__TAURI_INTERNALS__) return

    let cancelled = false
    let unlisten = null

    const setupMenuListener = async () => {
      const { listen } = await import('@tauri-apps/api/event')
      if (cancelled) return
      unlisten = await listen(NATIVE_MENU_EVENT, async (event) => {
        switch (event.payload) {
          case 'file.open':
            await menuActionsRef.current.openFileDialog()
            break
          case 'file.open_folder':
            await menuActionsRef.current.openDirectory()
            break
          case 'file.save':
            await menuActionsRef.current.saveCurrentDoc()
            break
          case 'file.save_as':
            await menuActionsRef.current.saveCurrentDocAs()
            break
          case 'file.export_markdown':
            await menuActionsRef.current.exportMarkdown()
            break
          default:
            break
        }
      })
      if (cancelled) {
        unlisten()
        unlisten = null
      }
    }

    void setupMenuListener()

    return () => {
      cancelled = true
      if (unlisten) {
        unlisten()
        unlisten = null
      }
    }
  }, [])

  useEffect(() => {
    if (!editor) return
    editor.setEditable(!currentDocDeleted)
  }, [editor, currentDocDeleted])

  // Cmd+F / Cmd+H keyboard shortcuts for search/replace
  useEffect(() => {
    const handleSearchShortcut = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault()
        setSearchBarVisible(true)
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'h') {
        e.preventDefault()
        setSearchBarVisible(true)
        setShowReplace(true)
      }
    }
    document.addEventListener('keydown', handleSearchShortcut)
    return () => document.removeEventListener('keydown', handleSearchShortcut)
  }, [])

  const handleCloseSearch = useCallback(() => {
    setSearchBarVisible(false)
    editor?.commands.focus()
  }, [editor])

  const handleToggleReplace = useCallback(() => {
    setShowReplace((v) => !v)
  }, [])

  return (
    <div className={styles.container}>
      <Sidebar
        headings={headings}
        activeId={activeId}
        open={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        editor={editor}
        docs={treeItems}
        editable={treeEditable}
        currentItemId={currentTreeItemId}
        onSwitchDoc={treeEditable ? (item) => switchDoc(item.id) : openWorkspaceDoc}
        onCreateDoc={createDoc}
        onCreateFolder={createFolder}
        onDeleteItem={deleteItem}
        onMoveItem={moveItem}
        onRename={renameDoc}
      />
      <div className={styles.main}>
        <TabBar
          docs={visibleTabs}
          currentDocId={currentDocId}
          onSwitch={switchDoc}
          onCreate={createNewFile}
          onClose={closeTab}
          onRename={renameDoc}
        />
        <Toolbar
          editor={editor}
          theme={theme}
          onToggleTheme={toggleTheme}
        />
        {currentDocDeleted && (
          <div className={styles.deletedBanner}>This file has been deleted from disk.</div>
        )}
        <div className={styles.editorArea}>
          <SearchBar
            editor={editor}
            visible={searchBarVisible}
            showReplace={showReplace}
            onClose={handleCloseSearch}
            onToggleReplace={handleToggleReplace}
          />
          <Editor onReady={handleEditorReady} />
        </div>
      </div>
    </div>
  )
}
