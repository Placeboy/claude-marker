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
- **Markdown conversion**: `src/utils/markdown.js` — regex-based `markdownToHtml()` import and `turndown`-based HTML→Markdown export. `createTurndownService()` is exported for reuse (e.g. by the source-edit extension). Images with `data-original-src` are exported using the original relative path. Turndown is configured with `hr: '---'`, `emDelimiter: '*'`, `bulletListMarker: '-'`, and a compact list-item rule to keep output format stable across round-trips. GFM tables are parsed on import and exported as pipe-table syntax via custom turndown rules for `table`/`tr`/`th`/`td`. Inline math (`$...$`) and block math (`$$...$$`) are extracted before inline processing to prevent formula content from being interpreted as emphasis, then restored after HTML generation.
- **Document management**: `src/hooks/useDocuments.js` manages three document sources: `local` (localStorage), `file` (opened via native dialog), and `workspace` (folder tree). Tracks recent tabs. File-sourced docs are watched for external changes via `watchFile` and auto-reload when the editor is not focused; a self-write guard (`selfWriteRef`) prevents reload loops from auto-save; `lastFileContentRef` stores the round-tripped markdown after each load or save and is compared in `flush()` to skip writes when content is unchanged, preventing spurious file modifications on open. Workspace directories are watched via `watchDirectory` for structural changes (create/remove); the sidebar tree auto-refreshes, and open tabs whose files are deleted are marked `deleted` (read-only, strikethrough) until the file reappears. When a markdown file with relative image paths is opened in Tauri, `resolveLocalImages()` reads each image via `readBinaryFile`, stores it in the image store, and sets `data-original-src` so the original path survives export.
- **Tables**: `@tiptap/extension-table` (Table, TableRow, TableHeader, TableCell) with `resizable: true`. Inserted via `/table` slash command (3×3 with header row). Tab/Shift+Tab navigates cells; Tab on the last cell appends a new row. Alt+Shift+Arrow shortcuts add rows/columns. `src/components/TableControls/TableControls.jsx` is a floating toolbar (shown when `editor.isActive('table')`) for row/column insert, delete, and merge/split operations. Column widths are draggable.
- **Search & Replace**: Custom TipTap extension at `src/extensions/SearchReplace.jsx` using a ProseMirror plugin with `Decoration.inline()` highlights. UI is `src/components/SearchBar/SearchBar.jsx`, positioned absolute top-right inside `.editorArea`. Opened via Cmd+F (find) / Cmd+H (find & replace) in `src/App.jsx`.
- **Code block syntax highlight**: `CodeBlockLowlight` extended with a custom `ReactNodeViewRenderer` (`src/components/CodeBlock/CodeBlock.jsx`) that adds a language selector dropdown. The `lowlight` library (with `common` language set) applies highlight.js classes; CSS variables in `global.css` theme both light and dark modes.
- **Math**: `src/extensions/MathExtension.jsx` provides `InlineMath` and `BlockMath` custom node extensions using KaTeX for rendering. Inline math is inserted via `$...$` in Markdown or Cmd/Ctrl+Shift+M shortcut; block math via `$$...$$` or `/math` slash commands. Turndown rules in `markdown.js` export math nodes back to `$`/`$$` syntax.
- **Markdown source edit**: `src/extensions/MarkdownSourceEdit.jsx` — double-click any block (except images, bookmarks, tables, and code blocks) to open an inline textarea showing the block's raw Markdown. Edits are parsed back to ProseMirror nodes on blur or Escape.
- **Theme**: `src/App.jsx` manages a `theme` state (light/dark/system) persisted to localStorage under `markdown-editor-theme`. Sets `data-theme` on `<html>` so `[data-theme="dark"]` CSS variables in `global.css` take effect. System mode tracks `prefers-color-scheme` via a `matchMedia` listener. Toggle button in the Toolbar cycles through light → dark → system.
- **Styling**: CSS Modules per component + `src/styles/global.css` for CSS variables and reset. No CSS framework.
- **Tauri adapter**: `src/utils/tauriAdapter.js` provides cross-environment helpers (`openExternal`, `saveTextFile`, `exportPdf`, `readTextFile`, `readBinaryFile`, `writeTextFile`, `moveFile`, `scanMarkdownDirectory`, `watchFile`, `watchDirectory`, `onAppClose`). Includes dialog concurrency guard. Uses runtime `isTauri()` detection with dynamic imports so web builds are unaffected.
- **Desktop shell**: `src-tauri/` contains the Tauri v2 Rust backend. Plugins: `shell`, `dialog`, `fs`. `lib.rs` provides a native macOS File menu (Open, Open Folder, Save, Save As, Export), file I/O commands (text and base64-encoded binary), filesystem move/rename, and recursive markdown directory scanning. Workspace drag-and-drop moves files on disk via the `move_file` command.

## Key conventions

- All components use CSS Modules (`.module.css`).
- JSX files use `.jsx` extension (required by Vite — `.js` files cannot contain JSX).
- No TypeScript.
- No test framework configured.
- Storage key: `markdown-editor-content` in localStorage.

## Known limitations

- Markdown import parser is regex-based and won't handle deeply nested or complex Markdown perfectly.
- No collaborative editing.
