import TurndownService from 'turndown'

export function editorToMarkdown(editor) {
  const html = editor.getHTML()
  const td = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
  })

  td.addRule('taskList', {
    filter: (node) => node.nodeName === 'LI' && node.parentNode?.getAttribute('data-type') === 'taskList',
    replacement: (content, node) => {
      const checked = node.getAttribute('data-checked') === 'true'
      return `${checked ? '- [x]' : '- [ ]'} ${content.trim()}\n`
    },
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
      const imageId = node.getAttribute('data-image-id')
      const src = imageId ? `img://${imageId}` : (node.getAttribute('src') || '')
      return `![${alt}](${src})`
    },
  })

  return td.turndown(html)
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
