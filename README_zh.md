中文 | [English](./README.md)

# Markdown 编辑器

一款轻量级、Notion 风格的 Markdown 编辑器，基于 React 和 TipTap 构建。可作为 Web 应用运行，也可通过 Tauri v2 打包为原生桌面应用。

![React](https://img.shields.io/badge/React-18-blue)
![TipTap](https://img.shields.io/badge/TipTap-v2-purple)
![Vite](https://img.shields.io/badge/Vite-5-yellow)
![Tauri](https://img.shields.io/badge/Tauri-v2-orange)

## 功能特性

- **所见即所得编辑** — 基于 TipTap (ProseMirror) 的富文本编辑
- **Markdown 快捷输入** — 输入 `# ` 转为标题、`- ` 转为列表、`> ` 转为引用、``` 转为代码块
- **搜索替换** — Cmd/Ctrl+F 查找，Cmd/Ctrl+H 查找并替换，支持匹配高亮和区分大小写
- **键盘快捷键** — Cmd/Ctrl+B（加粗）、Cmd/Ctrl+I（斜体）、Cmd/Ctrl+U（下划线）、Cmd/Ctrl+Shift+S（删除线）、Cmd/Ctrl+E（行内代码）、Cmd/Ctrl+Shift+H（高亮）、Cmd/Ctrl+K（链接）
- **斜杠命令** — 输入 `/` 打开命令菜单，可插入标题、列表、引用、代码块、分割线、待办列表
- **侧边目录** — 自动从 H1–H3 标题生成目录，点击跳转，当前位置高亮
- **自动保存** — 内容自动保存到 localStorage
- **导入 / 导出** — 支持导入和导出 `.md` 文件
- **语法高亮** — 代码块支持 highlight.js 语法高亮
- **简洁界面** — 极简设计，编辑区最大宽度 720px 居中，侧边栏可收起

## 从源码构建

### 环境要求

| 工具 | 最低版本 | 安装方式 |
|------|---------|---------|
| **Node.js** | >= 18 | https://nodejs.org/ 或 `brew install node` |
| **npm** | >= 9（随 Node 一起安装） | |
| **Rust** | >= 1.77 (stable) | https://rustup.rs/ |
| **系统依赖** | 见下方 | |

**macOS** — 安装 Xcode 命令行工具（提供 clang、WebKit 等）：

```bash
xcode-select --install
```

**Linux (Debian/Ubuntu)** — 安装 Tauri 所需的系统依赖：

```bash
sudo apt update
sudo apt install -y libwebkit2gtk-4.1-dev build-essential curl wget \
  file libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev
```

**Windows** — 安装 [Microsoft C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) 以及 [WebView2](https://developer.microsoft.com/en-us/microsoft-edge/webview2/)（Windows 11 已预装）。

### 仅 Web 版（无需 Rust）

```bash
git clone https://github.com/Placeboy/markdown-editor.git
cd markdown-editor
npm install
npm run dev        # 开发服务器 http://localhost:5173
npm run build      # 生产构建，输出到 dist/
```

### 桌面应用（Tauri）

```bash
git clone https://github.com/Placeboy/markdown-editor.git
cd markdown-editor
npm install

# 开发模式（热重载）
npm run tauri:dev

# 生产构建 — 安装包输出到 src-tauri/target/release/bundle/
npm run tauri:build
```

> 首次运行时 Cargo 会下载并编译 Rust 依赖，后续构建为增量编译，速度会快很多。

## 键盘快捷键

| 快捷键 | 功能 |
|--------|------|
| `Cmd/Ctrl + B` | 加粗 |
| `Cmd/Ctrl + I` | 斜体 |
| `Cmd/Ctrl + U` | 下划线 |
| `Cmd/Ctrl + Shift + S` | 删除线 |
| `Cmd/Ctrl + E` | 行内代码 |
| `Cmd/Ctrl + Shift + H` | 高亮 |
| `Cmd/Ctrl + K` | 插入链接 |
| `Cmd/Ctrl + F` | 查找 |
| `Cmd/Ctrl + H` | 查找并替换 |
| `Tab / Shift+Tab` | 列表缩进 / 取消缩进 |
| `/` | 打开斜杠命令菜单 |

## Markdown 输入快捷方式

| 输入 | 效果 |
|------|------|
| `# ` | 一级标题 |
| `## ` | 二级标题 |
| `### ` | 三级标题 |
| `- ` 或 `* ` | 无序列表 |
| `1. ` | 有序列表 |
| `> ` | 引用块 |
| `` ``` `` | 代码块 |
| `---` | 分割线 |

## 项目结构

```
src/
├── main.jsx                   # 入口文件
├── App.jsx                    # 根组件（侧边栏 + 工具栏 + 编辑器）
├── components/
│   ├── Editor/                # TipTap 编辑器封装
│   ├── Toolbar/               # 格式化按钮
│   ├── Sidebar/               # 侧边目录 + 文件树
│   ├── TabBar/                # 文档标签页
│   └── SlashMenu/             # 斜杠命令弹出菜单
├── extensions/
│   └── SlashCommand.jsx       # TipTap 斜杠命令扩展
├── hooks/
│   ├── useAutoSave.js         # 自动保存到 localStorage
│   ├── useDocuments.js        # 多来源文档管理
│   └── useToc.js              # 提取标题生成目录
├── utils/
│   ├── tauriAdapter.js        # Tauri/Web 跨环境适配器
│   └── markdown.js            # Markdown 转换工具
└── styles/
    └── global.css             # CSS 变量、重置样式、主题
src-tauri/                     # Tauri v2 桌面外壳 (Rust)
├── tauri.conf.json            # 窗口、CSP、打包配置
├── capabilities/default.json  # 权限声明
└── src/
    ├── main.rs                # Rust 入口
    └── lib.rs                 # 原生菜单、文件读写、工作区扫描
```

## 技术栈

- **React 18** + **Vite** — 快速开发/构建工具链
- **TipTap v2** (ProseMirror) — 富文本编辑器引擎
- **highlight.js** (lowlight) — 代码语法高亮
- **CSS Modules** — 组件级样式隔离
- **Turndown** — HTML 转 Markdown（用于导出）
- **Tauri v2** — 原生桌面外壳（使用系统 WebView，约 10 MB）
- **localStorage** — 客户端本地持久化

## 许可证

MIT
