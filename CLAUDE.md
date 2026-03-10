# CLAUDE.md

Project context for Claude Code.

## What is this?

A lightweight Notion-style Markdown editor. React 18 + Vite + TipTap v2. Runs as a web app or a native desktop app via Tauri v2.

## Commands

```bash
npm run dev          # Start dev server (Vite, port 5173)
npm run build        # Production build to dist/
npm run preview      # Preview production build
npm run tauri:dev    # Start Tauri desktop dev mode (requires Rust)
npm run tauri:build  # Build native desktop app (requires Rust)
```

## Architecture

- **Editor engine**: TipTap v2 (ProseMirror wrapper). All editor extensions are configured in `src/components/Editor/Editor.jsx`.
- **Slash commands**: Custom TipTap extension at `src/extensions/SlashCommand.jsx` using `@tiptap/suggestion`. The popup UI is `src/components/SlashMenu/SlashMenu.jsx`. Keyboard events are forwarded via `CustomEvent('slash-menu-keydown')`.
- **TOC**: `src/hooks/useToc.js` extracts headings from ProseMirror doc via `doc.descendants()`. Active heading tracked with IntersectionObserver.
- **Auto-save**: `src/hooks/useAutoSave.js` debounces (1s) and writes editor JSON to localStorage under key `markdown-editor-content`.
- **Markdown conversion**: `src/utils/markdown.js` — regex-based `markdownToHtml()` import and `turndown`-based HTML→Markdown export (dynamic import).
- **Document management**: `src/hooks/useDocuments.js` manages three document sources: `local` (localStorage), `file` (opened via native dialog), and `workspace` (folder tree). Tracks recent tabs. File-sourced docs are watched for external changes via `watchFile` and auto-reload when the editor is not focused; a self-write guard prevents reload loops from auto-save.
- **Styling**: CSS Modules per component + `src/styles/global.css` for CSS variables and reset. No CSS framework.
- **Tauri adapter**: `src/utils/tauriAdapter.js` provides cross-environment helpers (`openExternal`, `saveTextFile`, `exportPdf`, `readTextFile`, `writeTextFile`, `moveFile`, `scanMarkdownDirectory`, `watchFile`, `onAppClose`). Includes dialog concurrency guard. Uses runtime `isTauri()` detection with dynamic imports so web builds are unaffected.
- **Desktop shell**: `src-tauri/` contains the Tauri v2 Rust backend. Plugins: `shell`, `dialog`, `fs`. `lib.rs` provides a native macOS File menu (Open, Open Folder, Save, Save As, Export), file I/O commands, filesystem move/rename, and recursive markdown directory scanning. Workspace drag-and-drop moves files on disk via the `move_file` command.

## Key conventions

- All components use CSS Modules (`.module.css`).
- JSX files use `.jsx` extension (required by Vite — `.js` files cannot contain JSX).
- No TypeScript.
- No test framework configured.
- Storage key: `markdown-editor-content` in localStorage.

## Known limitations

- Markdown import parser is regex-based and won't handle deeply nested or complex Markdown perfectly.
- No dark mode toggle yet (CSS variables are prepared for it).
- No collaborative editing.
