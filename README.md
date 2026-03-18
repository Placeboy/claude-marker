[中文](./README_zh.md) | English

# Markdown Editor

A lightweight, Notion-style Markdown editor built with React and TipTap. Runs as a web app or a native desktop app via Tauri v2.

![React](https://img.shields.io/badge/React-18-blue)
![TipTap](https://img.shields.io/badge/TipTap-v2-purple)
![Vite](https://img.shields.io/badge/Vite-5-yellow)
![Tauri](https://img.shields.io/badge/Tauri-v2-orange)

## Features

- **WYSIWYG Editing** — Rich text editing powered by TipTap (ProseMirror)
- **Markdown Shortcuts** — Type `# ` for headings, `- ` for lists, `> ` for quotes, ``` for code blocks
- **Search & Replace** — Cmd/Ctrl+F to find, Cmd/Ctrl+H to find & replace, with match highlighting and case-sensitive toggle
- **Keyboard Shortcuts** — Cmd/Ctrl+B (bold), Cmd/Ctrl+I (italic), Cmd/Ctrl+U (underline), Cmd/Ctrl+Shift+S (strikethrough), Cmd/Ctrl+E (inline code), Cmd/Ctrl+Shift+H (highlight), Cmd/Ctrl+K (link)
- **Slash Commands** — Type `/` to open a command menu for inserting headings, lists, quotes, code blocks, dividers, and task lists
- **Table of Contents** — Auto-generated sidebar TOC from H1–H3 headings with click-to-scroll and active heading highlight
- **Auto Save** — Content is automatically saved to localStorage
- **Import / Export** — Import and export `.md` files
- **Syntax Highlighting** — Code blocks with highlight.js support
- **Clean UI** — Minimal design with a centered 720px editor area, collapsible sidebar

## Build from Source

### Prerequisites

| Tool | Minimum Version | Install |
|------|----------------|---------|
| **Node.js** | >= 18 | https://nodejs.org/ or `brew install node` |
| **npm** | >= 9 (ships with Node) | |
| **Rust** | >= 1.77 (stable) | https://rustup.rs/ |
| **System libs** | see below | |

**macOS** — Install Xcode Command Line Tools (provides clang, WebKit, etc.):

```bash
xcode-select --install
```

**Linux (Debian/Ubuntu)** — Install system dependencies required by Tauri:

```bash
sudo apt update
sudo apt install -y libwebkit2gtk-4.1-dev build-essential curl wget \
  file libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev
```

**Windows** — Install [Microsoft C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) and [WebView2](https://developer.microsoft.com/en-us/microsoft-edge/webview2/) (pre-installed on Windows 11).

### Web Only (no Rust needed)

```bash
git clone https://github.com/Placeboy/markdown-editor.git
cd markdown-editor
npm install
npm run dev        # Dev server at http://localhost:5173
npm run build      # Production build to dist/
```

### Desktop App (Tauri)

```bash
git clone https://github.com/Placeboy/markdown-editor.git
cd markdown-editor
npm install

# Development (live-reload)
npm run tauri:dev

# Production build — outputs installer to src-tauri/target/release/bundle/
npm run tauri:build
```

> On first run, Cargo will download and compile Rust dependencies. Subsequent builds will be incremental and much faster.

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd/Ctrl + B` | Bold |
| `Cmd/Ctrl + I` | Italic |
| `Cmd/Ctrl + U` | Underline |
| `Cmd/Ctrl + Shift + S` | Strikethrough |
| `Cmd/Ctrl + E` | Inline code |
| `Cmd/Ctrl + Shift + H` | Highlight |
| `Cmd/Ctrl + K` | Insert link |
| `Cmd/Ctrl + F` | Find |
| `Cmd/Ctrl + H` | Find & Replace |
| `Tab / Shift+Tab` | Indent / outdent list |
| `/` | Open slash command menu |

## Markdown Input Shortcuts

| Input | Result |
|-------|--------|
| `# ` | Heading 1 |
| `## ` | Heading 2 |
| `### ` | Heading 3 |
| `- ` or `* ` | Bullet list |
| `1. ` | Ordered list |
| `> ` | Blockquote |
| `` ``` `` | Code block |
| `---` | Horizontal rule |

## Project Structure

```
src/
├── main.jsx                   # Entry point
├── App.jsx                    # Root layout (sidebar + toolbar + editor)
├── components/
│   ├── Editor/                # TipTap editor wrapper
│   ├── Toolbar/               # Format buttons
│   ├── Sidebar/               # Table of contents + file tree
│   ├── TabBar/                # Document tabs
│   └── SlashMenu/             # Slash command popup menu
├── extensions/
│   └── SlashCommand.jsx       # TipTap slash command extension
├── hooks/
│   ├── useAutoSave.js         # Auto-save to localStorage
│   ├── useDocuments.js        # Multi-source document management
│   └── useToc.js              # Extract headings for TOC
├── utils/
│   ├── tauriAdapter.js        # Tauri/Web cross-environment adapter
│   └── markdown.js            # Markdown conversion utilities
└── styles/
    └── global.css             # CSS variables, reset, theme
src-tauri/                     # Tauri v2 desktop shell (Rust)
├── tauri.conf.json            # Window, CSP, bundle config
├── capabilities/default.json  # Permission declarations
└── src/
    ├── main.rs                # Rust entry point
    └── lib.rs                 # Native menu, file I/O, workspace scanning
```

## Tech Stack

- **React 18** + **Vite** — Fast dev/build toolchain
- **TipTap v2** (ProseMirror) — Rich text editor engine
- **highlight.js** via lowlight — Code syntax highlighting
- **CSS Modules** — Scoped component styling
- **Turndown** — HTML to Markdown conversion for export
- **Tauri v2** — Native desktop shell (uses system WebView, ~10 MB)
- **localStorage** — Client-side persistence

## License

MIT
