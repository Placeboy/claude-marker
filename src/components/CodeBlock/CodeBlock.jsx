import { NodeViewWrapper, NodeViewContent } from '@tiptap/react'
import styles from './CodeBlock.module.css'

const LANGUAGES = [
  { value: null, label: 'auto' },
  { value: 'bash', label: 'Bash' },
  { value: 'c', label: 'C' },
  { value: 'cpp', label: 'C++' },
  { value: 'csharp', label: 'C#' },
  { value: 'css', label: 'CSS' },
  { value: 'diff', label: 'Diff' },
  { value: 'go', label: 'Go' },
  { value: 'graphql', label: 'GraphQL' },
  { value: 'html', label: 'HTML' },
  { value: 'java', label: 'Java' },
  { value: 'javascript', label: 'JavaScript' },
  { value: 'json', label: 'JSON' },
  { value: 'kotlin', label: 'Kotlin' },
  { value: 'lua', label: 'Lua' },
  { value: 'markdown', label: 'Markdown' },
  { value: 'php', label: 'PHP' },
  { value: 'python', label: 'Python' },
  { value: 'ruby', label: 'Ruby' },
  { value: 'rust', label: 'Rust' },
  { value: 'scss', label: 'SCSS' },
  { value: 'shell', label: 'Shell' },
  { value: 'sql', label: 'SQL' },
  { value: 'swift', label: 'Swift' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'xml', label: 'XML' },
  { value: 'yaml', label: 'YAML' },
]

export default function CodeBlock({ node, updateAttributes, extension }) {
  const currentLang = node.attrs.language

  return (
    <NodeViewWrapper className={styles.codeBlockWrapper}>
      <div className={styles.codeBlockHeader} contentEditable={false}>
        <select
          className={styles.languageSelect}
          value={currentLang || ''}
          onChange={e => updateAttributes({ language: e.target.value || null })}
        >
          {LANGUAGES.map(lang => (
            <option key={lang.value || 'auto'} value={lang.value || ''}>
              {lang.label}
            </option>
          ))}
        </select>
      </div>
      <pre>
        <NodeViewContent as="code" />
      </pre>
    </NodeViewWrapper>
  )
}
