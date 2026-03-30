import { useEffect } from 'react'

/**
 * Auto-scroll a container when dragging near its top/bottom edges.
 * Fixes the issue where drag-to-select can't scroll overflow containers.
 */
export default function useEdgeScroll(ref) {
  useEffect(() => {
    const el = ref.current
    if (!el) return

    const EDGE_SIZE = 48
    const MAX_SPEED = 20
    let rafId = null
    let isDragging = false
    let mouseY = 0

    function getSpeed(distance) {
      const t = 1 - distance / EDGE_SIZE
      return Math.round(MAX_SPEED * t * t)
    }

    function tick() {
      if (!isDragging) return
      const rect = el.getBoundingClientRect()
      const topDist = mouseY - rect.top
      const bottomDist = rect.bottom - mouseY

      if (topDist < EDGE_SIZE && topDist >= 0) {
        el.scrollTop -= getSpeed(topDist)
      } else if (bottomDist < EDGE_SIZE && bottomDist >= 0) {
        el.scrollTop += getSpeed(bottomDist)
      }

      rafId = requestAnimationFrame(tick)
    }

    function onMouseDown(e) {
      if (e.button !== 0) return
      isDragging = true
      mouseY = e.clientY
      rafId = requestAnimationFrame(tick)
    }

    function onMouseMove(e) {
      mouseY = e.clientY
    }

    function onMouseUp() {
      isDragging = false
      if (rafId) {
        cancelAnimationFrame(rafId)
        rafId = null
      }
    }

    el.addEventListener('mousedown', onMouseDown)
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)

    return () => {
      el.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
      if (rafId) cancelAnimationFrame(rafId)
    }
  }, [ref])
}