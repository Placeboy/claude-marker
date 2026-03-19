import TurndownService from 'turndown'

export function createTurndownService() {
  const td = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
    hr: '---',
    emDelimiter: '*',
    bulletListMarker: '-',
  })

  td.addRule('listItemCompact', {
    filter: (node) => node.nodeName === 'LI' && node.parentNode?.getAttribute('data-type') !== 'taskList',
    replacement: (content, node, options) => {
      const cleaned = content.replace(/^\n+/, '').replace(/\n+$/, '')
      const isOrdered = node.parentNode?.nodeName === 'OL'
      const prefix = isOrdered
        ? (Array.from(node.parentNode.children).indexOf(node) + 1) + '. '
        : options.bulletListMarker + ' '
      return prefix + cleaned.replace(/\n/g, '\n  ') + '\n'
    },
  })

  td.addRule('taskList', {
    filter: (node) => node.nodeName === 'LI' && node.parentNode?.getAttribute('data-type') === 'taskList',
    replacement: (content, node) => {
      const checked = node.getAttribute('data-checked') === 'true'
      return `${checked ? '- [x]' : '- [ ]'} ${content.trim()}\n`
    },
  })

  td.addRule('tableCell', {
    filter: ['th', 'td'],
    replacement: (content, node) => {
      const siblings = Array.from(node.parentNode.children).filter(n => n.nodeName === 'TH' || n.nodeName === 'TD')
      const isFirst = siblings.indexOf(node) === 0
      const isLast = siblings.indexOf(node) === siblings.length - 1
      const cell = content.trim().replace(/\n+/g, ' ').replace(/\|/g, '\\|')
      return (isFirst ? '| ' : ' ') + cell + (isLast ? ' |' : ' |')
    },
  })

  td.addRule('tableRow', {
    filter: 'tr',
    replacement: (content, node) => {
      const hasTh = node.querySelector('th') !== null
      if (hasTh) {
        const colCount = node.querySelectorAll('th, td').length
        const sep = '| ' + Array(colCount).fill('---').join(' | ') + ' |'
        return '\n' + content + '\n' + sep
      }
      return '\n' + content
    },
  })

  td.addRule('tableSection', {
    filter: ['thead', 'tbody', 'tfoot'],
    replacement: (content) => content,
  })

  td.addRule('table', {
    filter: 'table',
    replacement: (content) => '\n\n' + content.replace(/^\n/, '').trimEnd() + '\n\n',
  })

  td.addRule('highlight', {
    filter: 'mark',
    replacement: (content) => `==${content}==`,
  })

  td.addRule('bookmark', {
    filter: (node) => node.nodeName === 'DIV' && node.getAttribute('data-type') === 'bookmark',
    replacement: (content, node) => {
      const title = node.getAttribute('data-title') || node.getAttribute('data-url') || 'link'
      const url = node.getAttribute('data-url') || ''
      return `[${title}](${url})\n\n`
    },
  })

  td.addRule('image', {
    filter: 'img',
    replacement: (content, node) => {
      const alt = node.getAttribute('alt') || ''
      const originalSrc = node.getAttribute('data-original-src')
      if (originalSrc) return `![${alt}](${originalSrc})`
      const imageId = node.getAttribute('data-image-id')
      const src = imageId ? `img://${imageId}` : (node.getAttribute('src') || '')
      return `![${alt}](${src})`
    },
  })

  return td
}

export function editorToMarkdown(editor) {
  const html = editor.getHTML()
  return createTurndownService().turndown(html)
}

export function markdownToHtml(md) {
  const codeBlocks = []
  let processed = md.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
    const placeholder = `\x00CODEBLOCK${codeBlocks.length}\x00`
    const langAttr = lang ? ` class="language-${lang}"` : ''
    codeBlocks.push(`<pre><code${langAttr}>${escapeHtml(code.trim())}</code></pre>`)
    return placeholder
  })

  processed = processed
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/~~(.+?)~~/g, '<s>$1</s>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/==(.+?)==/g, '<mark>$1</mark>')
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1">')
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>')

  // GFM tables — must run after inline formatting so cell content is already converted
  processed = processed.replace(
    /^(\|.+\|[ \t]*)\n(\|[ \t]*[-: |]+[-: |]*[ \t]*)\n((?:\|.+\|[ \t]*\n?)+)/gm,
    (_, headerLine, _sep, bodyLines) => {
      const parseRow = (line) =>
        line.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim())
      const headers = parseRow(headerLine)
      const rows = bodyLines.trim().split('\n').filter((l) => l.trim()).map(parseRow)
      const colCount = headers.length
      const thead = `<thead><tr>${headers.map((h) => `<th>${h}</th>`).join('')}</tr></thead>`
      const tbody = `<tbody>${rows.map((r) => {
        while (r.length < colCount) r.push('')
        return `<tr>${r.slice(0, colCount).map((c) => `<td>${c}</td>`).join('')}</tr>`
      }).join('')}</tbody>`
      return `<table>${thead}${tbody}</table>`
    }
  )

  processed = processed
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/^---$/gm, '<hr>')
    .replace(/^\*\*\*$/gm, '<hr>')
    .replace(/^> (.+)$/gm, '<blockquote><p>$1</p></blockquote>')
    .replace(/^- \[x\] (.+)$/gm, '<ul data-type="taskList"><li data-checked="true"><p>$1</p></li></ul>')
    .replace(/^- \[ \] (.+)$/gm, '<ul data-type="taskList"><li data-checked="false"><p>$1</p></li></ul>')
    .replace(/^[-*] (.+)$/gm, '<ul><li><p>$1</p></li></ul>')
    .replace(/^\d+\. (.+)$/gm, '<ol><li><p>$1</p></li></ol>')

  processed = processed.replace(
    /^(?!<[hupob]|<li|<hr|<code|<pre|<img|\x00CODEBLOCK)(.+)$/gm,
    '<p>$1</p>'
  )

  processed = processed
    .replace(/<\/ul>\n<ul data-type="taskList">/g, '\n')
    .replace(/<\/ul>\n<ul>/g, '\n')
    .replace(/<\/ol>\n<ol>/g, '\n')

  // Strip Markdown backslash escapes (e.g. 1\. → 1.) but not inside code blocks
  processed = processed.replace(/\\([\\`*_{}[\]()#+\-.!>~|])/g, '$1')

  codeBlocks.forEach((block, i) => {
    processed = processed.replace(`\x00CODEBLOCK${i}\x00`, block)
  })

  return processed.replace(/\n{2,}/g, '\n')
}

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}
