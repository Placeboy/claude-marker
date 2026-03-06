import { useState, useCallback, useEffect } from 'react'
import Sidebar from './components/Sidebar/Sidebar'
import TabBar from './components/TabBar/TabBar'
import Toolbar from './components/Toolbar/Toolbar'
import Editor from './components/Editor/Editor'
import useToc from './hooks/useToc'
import useDocuments from './hooks/useDocuments'
import useHashRouter from './hooks/useHashRouter'
import styles from './App.module.css'

export default function App() {
  const [editor, setEditor] = useState(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const { headings, activeId } = useToc(editor)
  const { hashDocId, setHash, replaceHash } = useHashRouter()
  const {
    docs,
    currentDocId,
    currentDocName,
    lastSaved,
    switchDoc,
    createDoc,
    createFolder,
    deleteItem,
    closeTab,
    moveItem,
    renameDoc,
  } = useDocuments(editor, { hashDocId, setHash, replaceHash })

  const handleEditorReady = useCallback((editorInstance) => {
    setEditor(editorInstance)
  }, [])

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

  return (
    <div className={styles.container}>
      <Sidebar
        headings={headings}
        activeId={activeId}
        open={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        editor={editor}
        docs={docs}
        currentDocId={currentDocId}
        onSwitchDoc={switchDoc}
        onCreateDoc={createDoc}
        onCreateFolder={createFolder}
        onDeleteItem={deleteItem}
        onMoveItem={moveItem}
        onRename={renameDoc}
      />
      <div className={styles.main}>
        <TabBar
          docs={docs.filter((d) => d.type === 'doc')}
          currentDocId={currentDocId}
          onSwitch={switchDoc}
          onCreate={createDoc}
          onClose={closeTab}
          onRename={renameDoc}
        />
        <Toolbar editor={editor} lastSaved={lastSaved} docName={currentDocName} />
        <div className={styles.editorArea}>
          <Editor onReady={handleEditorReady} />
        </div>
      </div>
    </div>
  )
}
