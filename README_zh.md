中文 | [English](./README.md)

# Markdown 编辑器

一款轻量级、Notion 风格的 Markdown 编辑器，基于 React 和 TipTap 构建。

![React](https://img.shields.io/badge/React-18-blue)
![TipTap](https://img.shields.io/badge/TipTap-v2-purple)
![Vite](https://img.shields.io/badge/Vite-5-yellow)

## 功能特性

- **所见即所得编辑** — 基于 TipTap (ProseMirror) 的富文本编辑
- **Markdown 快捷输入** — 输入 `# ` 转为标题、`- ` 转为列表、`> ` 转为引用、``` 转为代码块
- **键盘快捷键** — Cmd/Ctrl+B（加粗）、Cmd/Ctrl+I（斜体）、Cmd/Ctrl+U（下划线）、Cmd/Ctrl+Shift+S（删除线）、Cmd/Ctrl+E（行内代码）、Cmd/Ctrl+Shift+H（高亮）、Cmd/Ctrl+K（链接）
- **斜杠命令** — 输入 `/` 打开命令菜单，可插入标题、列表、引用、代码块、分割线、待办列表
- **侧边目录** — 自动从 H1–H3 标题生成目录，点击跳转，当前位置高亮
- **自动保存** — 内容自动保存到 localStorage
- **导入 / 导出** — 支持导入和导出 `.md` 文件
- **语法高亮** — 代码块支持 highlight.js 语法高亮
- **简洁界面** — 极简设计，编辑区最大宽度 720px 居中，侧边栏可收起

## 快速开始

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 生产环境构建
npm run build
```

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
│   ├── Toolbar/               # 格式化按钮 + 导入导出
│   ├── Sidebar/               # 侧边目录
│   └── SlashMenu/             # 斜杠命令弹出菜单
├── extensions/
│   └── SlashCommand.jsx       # TipTap 斜杠命令扩展
├── hooks/
│   ├── useAutoSave.js         # 自动保存到 localStorage
│   └── useToc.js              # 提取标题生成目录
└── styles/
    └── global.css             # CSS 变量、重置样式、主题
```

## 技术栈

- **React 18** + **Vite** — 快速开发/构建工具链
- **TipTap v2** (ProseMirror) — 富文本编辑器引擎
- **highlight.js** (lowlight) — 代码语法高亮
- **CSS Modules** — 组件级样式隔离
- **Turndown** — HTML 转 Markdown（用于导出）
- **localStorage** — 客户端本地持久化

## 许可证

MIT
