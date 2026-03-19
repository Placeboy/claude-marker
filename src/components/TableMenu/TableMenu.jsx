import { BubbleMenu } from '@tiptap/react'
import styles from './TableMenu.module.css'

export default function TableMenu({ editor }) {
  if (!editor) return null

  return (
    <BubbleMenu
      editor={editor}
      shouldShow={({ editor: e }) => e.isActive('table')}
      tippyOptions={{ placement: 'top', offset: [0, 8], duration: 100 }}
    >
      <div className={styles.menu}>
        <button className={styles.btn} onClick={() => editor.chain().focus().addRowBefore().run()} title="Insert row above (Alt+Shift+↑)">↑ Row</button>
        <button className={styles.btn} onClick={() => editor.chain().focus().addRowAfter().run()} title="Insert row below (Alt+Shift+↓)">↓ Row</button>
        <div className={styles.divider} />
        <button className={styles.btn} onClick={() => editor.chain().focus().addColumnBefore().run()} title="Insert column left (Alt+Shift+←)">← Col</button>
        <button className={styles.btn} onClick={() => editor.chain().focus().addColumnAfter().run()} title="Insert column right (Alt+Shift+→)">→ Col</button>
        <div className={styles.divider} />
        <button className={`${styles.btn} ${styles.danger}`} onClick={() => editor.chain().focus().deleteRow().run()} title="Delete row">Del Row</button>
        <button className={`${styles.btn} ${styles.danger}`} onClick={() => editor.chain().focus().deleteColumn().run()} title="Delete column">Del Col</button>
        <button className={`${styles.btn} ${styles.danger}`} onClick={() => editor.chain().focus().deleteTable().run()} title="Delete table">Del Table</button>
      </div>
    </BubbleMenu>
  )
}