/**
 * Tauri v2 adapter — provides cross-environment helpers.
 * When running inside Tauri, uses native APIs; otherwise falls back to Web APIs.
 * All Tauri modules are dynamically imported so web builds never pull them in.
 */

export function isTauri() {
  return typeof window !== 'undefined' && !!window.__TAURI_INTERNALS__
}

/**
 * Open a URL in the system default browser (Tauri) or a new tab (web).
 */
export async function openExternal(url) {
  if (isTauri()) {
    const { open } = await import('@tauri-apps/plugin-shell')
    await open(url)
  } else {
    window.open(url, '_blank', 'noopener,noreferrer')
  }
}

/**
 * Save a text string to a file.
 * Tauri: native "Save As" dialog + filesystem write.
 * Web: invisible <a download> click.
 */
export async function saveTextFile(content, defaultName, mimeType = 'text/plain') {
  if (isTauri()) {
    const { save } = await import('@tauri-apps/plugin-dialog')
    const { writeTextFile } = await import('@tauri-apps/plugin-fs')
    const filePath = await save({
      defaultPath: defaultName,
      filters: [{ name: 'All Files', extensions: ['*'] }],
    })
    if (filePath) {
      await writeTextFile(filePath, content)
    }
  } else {
    const blob = new Blob([content], { type: `${mimeType};charset=utf-8` })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = defaultName
    a.click()
    URL.revokeObjectURL(url)
  }
}

/**
 * Export editor content as PDF.
 * Tauri: write a self-contained HTML file to temp, open in system browser for Cmd+P.
 * Web: trigger window.print().
 */
export async function exportPdf(htmlContent) {
  if (isTauri()) {
    const { invoke } = await import('@tauri-apps/api/core')
    const { open } = await import('@tauri-apps/plugin-shell')
    const filePath = await invoke('generate_pdf', { html: htmlContent })
    await open(filePath)
  } else {
    window.print()
  }
}

/**
 * Register a callback for app-close events.
 * Tauri: listen to the Tauri window close-requested event.
 * Web: listen to beforeunload.
 * Returns an unlisten function.
 */
export function onAppClose(callback) {
  if (isTauri()) {
    let unlisten = null
    import('@tauri-apps/api/window').then(({ getCurrentWindow }) => {
      getCurrentWindow().onCloseRequested(async (event) => {
        callback()
      }).then((fn) => {
        unlisten = fn
      })
    })
    return () => { if (unlisten) unlisten() }
  } else {
    window.addEventListener('beforeunload', callback)
    return () => window.removeEventListener('beforeunload', callback)
  }
}
