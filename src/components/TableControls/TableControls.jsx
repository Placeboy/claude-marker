import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import styles from './TableControls.module.css'

const BTN = 20 // handle button size in px

function getHandlesForCell(cell) {
  const table = cell.closest('table')
  if (!table) return null
  const row = cell.closest('tr')
  const allRows = Array.from(table.querySelectorAll('tr'))
  const colIdx = Array.from(row.children).indexOf(cell)
  return {
    rowCell: row.firstElementChild || null,          // leftmost cell of hovered row
    colCell: allRows[0]?.children[colIdx] || null,   // top cell of hovered column
  }
}

export default function TableControls({ editor }) {
  const [handles, setHandles] = useState(null)   // { rowCell, colCell }
  const [menu, setMenu] = useState(null)         // { type:'row'|'col', rowRect, colRect }
  const menuRef = useRef(null)
  const hideTimerRef = useRef(null)
  const menuOpenRef = useRef(false)
  const scheduleHideRef = useRef(null)

  // Track menu-open state in a ref so event handlers see current value
  useEffect(() => { menuOpenRef.current = !!menu }, [menu])

  // Mouse tracking on the editor DOM
  useEffect(() => {
    if (!editor) return
    const dom = editor.view.dom
    const THRESHOLD = 12 // px from table edge to trigger handle

    const onMouseMove = (e) => {
      if (menuOpenRef.current) return
      clearTimeout(hideTimerRef.current)

      const cell = e.target.closest?.('td, th')
      if (!cell) { scheduleHideRef.current(); return }

      const table = cell.closest('table')
      if (!table) { scheduleHideRef.current(); return }

      // Use the tableWrapper for the outer bounds (it carries the border)
      const wrapper = table.closest('.tableWrapper') || table
      const wrapperRect = wrapper.getBoundingClientRect()

      const nearLeft = e.clientX <= wrapperRect.left + THRESHOLD
      const nearTop  = e.clientY <= wrapperRect.top  + THRESHOLD

      if (!nearLeft && !nearTop) {
        scheduleHideRef.current()
        return
      }

      const h = getHandlesForCell(cell)
      if (!h) return
      setHandles({
        rowCell: nearLeft ? h.rowCell : null,
        colCell: nearTop  ? h.colCell : null,
      })
    }

    const onMouseLeave = () => scheduleHideRef.current()

    dom.addEventListener('mousemove', onMouseMove)
    dom.addEventListener('mouseleave', onMouseLeave)
    return () => {
      dom.removeEventListener('mousemove', onMouseMove)
      dom.removeEventListener('mouseleave', onMouseLeave)
      clearTimeout(hideTimerRef.current)
    }
  }, [editor])

  // Close menu on outside click
  useEffect(() => {
    if (!menu) return
    const handler = (e) => {
      if (!menuRef.current?.contains(e.target)) {
        setMenu(null)
        setHandles(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [menu])

  if (!handles) return null

  const { rowCell, colCell } = handles
  const rowRect = rowCell?.getBoundingClientRect()
  const colRect = colCell?.getBoundingClientRect()

  const keepVisible = () => clearTimeout(hideTimerRef.current)
  const scheduleHide = () => {
    hideTimerRef.current = setTimeout(() => {
      if (!menuOpenRef.current) setHandles(null)
    }, 250)
  }
  // Keep a stable ref so the mousemove handler (closed over in useEffect) can call it
  scheduleHideRef.current = scheduleHide

  const openMenu = (type) => {
    setMenu({ type, rowRect: rowCell?.getBoundingClientRect(), colRect: colCell?.getBoundingClientRect() })
  }

  const act = (fn) => {
    fn()
    setMenu(null)
    setHandles(null)
  }

  const e = editor

  return createPortal(
    <>
      {/* Row handle — left of first-column cell, vertically centered */}
      {rowRect && (
        <button
          className={styles.handle}
          style={{ left: rowRect.left - BTN - 6, top: rowRect.top + rowRect.height / 2 - BTN / 2 }}
          onMouseEnter={keepVisible}
          onMouseLeave={scheduleHide}
          onClick={() => openMenu('row')}
          title="Row options"
        >
          <span className={styles.dots} />
        </button>
      )}

      {/* Column handle — above first-row cell, horizontally centered */}
      {colRect && (
        <button
          className={styles.handle}
          style={{ left: colRect.left + colRect.width / 2 - BTN / 2, top: colRect.top - BTN - 6 }}
          onMouseEnter={keepVisible}
          onMouseLeave={scheduleHide}
          onClick={() => openMenu('col')}
          title="Column options"
        >
          <span className={`${styles.dots} ${styles.dotsH}`} />
        </button>
      )}

      {/* Dropdown menu */}
      {menu && (
        <div
          ref={menuRef}
          className={styles.dropdown}
          style={menu.type === 'row'
            ? {
                left: (menu.rowRect?.left ?? 0) - 8,
                top: (menu.rowRect?.top ?? 0) + (menu.rowRect?.height ?? 0) / 2,
                transform: 'translate(-100%, -50%)',
              }
            : {
                left: (menu.colRect?.left ?? 0) + (menu.colRect?.width ?? 0) / 2,
                top: (menu.colRect?.top ?? 0) - 8,
                transform: 'translate(-50%, -100%)',
              }
          }
        >
          {menu.type === 'row' ? (
            <>
              <button className={styles.item} onClick={() => act(() => e.chain().focus().addRowBefore().run())}>↑ Insert row above</button>
              <button className={styles.item} onClick={() => act(() => e.chain().focus().addRowAfter().run())}>↓ Insert row below</button>
              <div className={styles.sep} />
              <button className={`${styles.item} ${styles.danger}`} onClick={() => act(() => e.chain().focus().deleteRow().run())}>Delete row</button>
              <button className={`${styles.item} ${styles.danger}`} onClick={() => act(() => e.chain().focus().deleteTable().run())}>Delete table</button>
            </>
          ) : (
            <>
              <button className={styles.item} onClick={() => act(() => e.chain().focus().addColumnBefore().run())}>← Insert column left</button>
              <button className={styles.item} onClick={() => act(() => e.chain().focus().addColumnAfter().run())}>→ Insert column right</button>
              <div className={styles.sep} />
              <button className={`${styles.item} ${styles.danger}`} onClick={() => act(() => e.chain().focus().deleteColumn().run())}>Delete column</button>
            </>
          )}
        </div>
      )}
    </>,
    document.body,
  )
}
