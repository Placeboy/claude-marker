# CLAUDE.md

Project context for Claude Code.

## What is this?

A lightweight Notion-style Markdown editor. React 18 + Vite + TipTap v2.

## Commands

```bash
npm run dev      # Start dev server (Vite, port 5173)
npm run build    # Production build to dist/
npm run preview  # Preview production build
```

## Architecture

- **Editor engine**: TipTap v2 (ProseMirror wrapper). All editor extensions are configured in `src/components/Editor/Editor.jsx`.
- **Slash commands**: Custom TipTap extension at `src/extensions/SlashCommand.jsx` using `@tiptap/suggestion`. The popup UI is `src/components/SlashMenu/SlashMenu.jsx`. Keyboard events are forwarded via `CustomEvent('slash-menu-keydown')`.
- **TOC**: `src/hooks/useToc.js` extracts headings from ProseMirror doc via `doc.descendants()`. Active heading tracked with IntersectionObserver.
- **Auto-save**: `src/hooks/useAutoSave.js` debounces (1s) and writes editor JSON to localStorage under key `markdown-editor-content`.
- **Markdown import**: `markdownToHtml()` in `src/components/Toolbar/Toolbar.jsx` is a regex-based converter. It first extracts code blocks, then processes inline formatting, then block-level elements. Not a full parser — handles common cases.
- **Markdown export**: Uses `turndown` library (dynamic import) to convert TipTap HTML → Markdown.
- **Styling**: CSS Modules per component + `src/styles/global.css` for CSS variables and reset. No CSS framework.

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
