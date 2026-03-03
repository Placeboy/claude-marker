import { useState, useCallback } from 'react'
import Sidebar from './components/Sidebar/Sidebar'
import Toolbar from './components/Toolbar/Toolbar'
import Editor from './components/Editor/Editor'
import useToc from './hooks/useToc'
import useAutoSave from './hooks/useAutoSave'
import styles from './App.module.css'

export default function App() {
  const [editor, setEditor] = useState(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const { headings, activeId } = useToc(editor)
  const { lastSaved } = useAutoSave(editor)

  const handleEditorReady = useCallback((editorInstance) => {
    setEditor(editorInstance)
  }, [])

  return (
    <div className={styles.container}>
      <Sidebar
        headings={headings}
        activeId={activeId}
        open={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        editor={editor}
      />
      <div className={styles.main}>
        <Toolbar editor={editor} lastSaved={lastSaved} />
        <div className={styles.editorArea}>
          <Editor onReady={handleEditorReady} />
        </div>
      </div>
    </div>
  )
}
