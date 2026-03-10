/**
 * Tauri v2 adapter — provides cross-environment helpers.
 * When running inside Tauri, uses native APIs; otherwise falls back to Web APIs.
 * All Tauri modules are dynamically imported so web builds never pull them in.
 */

export function isTauri() {
  return typeof window !== 'undefined' && !!window.__TAURI_INTERNALS__
}

function normalizeDialogPath(value) {
  return Array.isArray(value) ? value[0] : value
}

function fileNameFromPath(path) {
  return path?.split(/[/\\]/).pop() || 'Untitled'
}

let dialogOpen = false

export async function openExternal(url) {
  if (isTauri()) {
    const { open } = await import('@tauri-apps/plugin-shell')
    await open(url)
  } else {
    window.open(url, '_blank', 'noopener,noreferrer')
  }
}

export async function saveTextFile(content, defaultName, mimeType = 'text/plain') {
  if (isTauri()) {
    if (dialogOpen) return null
    dialogOpen = true
    try {
      const { save } = await import('@tauri-apps/plugin-dialog')
      const filePath = await save({
        defaultPath: defaultName,
        filters: [{ name: 'All Files', extensions: ['*'] }],
      })
      if (filePath) {
        await writeTextFile(filePath, content)
      }
      return filePath || null
    } finally {
      dialogOpen = false
    }
  }

  const blob = new Blob([content], { type: `${mimeType};charset=utf-8` })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = defaultName
  a.click()
  URL.revokeObjectURL(url)
  return defaultName
}

export async function exportPdf(htmlContent) {
  if (isTauri()) {
    const { invoke } = await import('@tauri-apps/api/core')
    await invoke('export_pdf_preview', { html: htmlContent })
    return
  }

  window.print()
}

export async function openTextFileDialog() {
  if (dialogOpen) return null
  dialogOpen = true
  try {
    if (isTauri()) {
      const { open } = await import('@tauri-apps/plugin-dialog')
      const filePath = normalizeDialogPath(await open({
        multiple: false,
        directory: false,
        filters: [{ name: 'Markdown', extensions: ['md', 'markdown', 'txt'] }],
      }))

      if (!filePath) return null

      return {
        path: filePath,
        name: fileNameFromPath(filePath),
        content: await readTextFile(filePath),
      }
    }

    return await new Promise((resolve) => {
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = '.md,.markdown,.txt'
      input.onchange = (e) => {
        const file = e.target.files?.[0]
        if (!file) {
          resolve(null)
          return
        }
        const reader = new FileReader()
        reader.onload = (event) => {
          resolve({
            path: null,
            name: file.name,
            content: String(event.target?.result || ''),
          })
        }
        reader.readAsText(file)
      }
      input.click()
    })
  } finally {
    dialogOpen = false
  }
}

export async function openDirectoryDialog() {
  if (!isTauri()) return null
  if (dialogOpen) return null
  dialogOpen = true
  try {
    const { open } = await import('@tauri-apps/plugin-dialog')
    const dirPath = normalizeDialogPath(await open({
      multiple: false,
      directory: true,
      recursive: true,
    }))

    return dirPath || null
  } finally {
    dialogOpen = false
  }
}

export async function readTextFile(path) {
  if (!path) return ''

  if (isTauri()) {
    const { invoke } = await import('@tauri-apps/api/core')
    return invoke('read_text_file', { path })
  }

  throw new Error('Reading arbitrary files is only supported in the desktop app.')
}

export async function writeTextFile(path, content) {
  if (!path) throw new Error('Missing file path.')

  if (isTauri()) {
    const { invoke } = await import('@tauri-apps/api/core')
    await invoke('write_text_file', { path, content })
    return
  }

  throw new Error('Writing arbitrary files is only supported in the desktop app.')
}

export async function moveFile(from, to) {
  if (!from || !to) throw new Error('Missing source or destination path.')

  if (isTauri()) {
    const { invoke } = await import('@tauri-apps/api/core')
    await invoke('move_file', { from, to })
    return
  }

  throw new Error('Moving files is only supported in the desktop app.')
}

export async function scanDirectory(path) {
  if (!path) return []

  if (isTauri()) {
    const { invoke } = await import('@tauri-apps/api/core')
    return invoke('scan_markdown_directory', { path })
  }

  return []
}

export async function watchFile(path, callback) {
  if (!isTauri() || !path) return () => {}

  const { watch } = await import('@tauri-apps/plugin-fs')
  const unwatch = await watch(path, (event) => {
    if (event.type?.modify || event.type === 'modify') {
      callback()
    }
  }, { delayMs: 500 })

  return unwatch
}

export function onAppClose(callback) {
  if (isTauri()) {
    return () => {}
  }
  window.addEventListener('beforeunload', callback)
  return () => window.removeEventListener('beforeunload', callback)
}
