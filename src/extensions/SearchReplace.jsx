import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'

const searchReplacePluginKey = new PluginKey('searchReplace')

function findMatches(doc, searchTerm, caseSensitive) {
  if (!searchTerm) return []

  const results = []
  const flags = caseSensitive ? 'g' : 'gi'
  const escaped = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  let regex
  try {
    regex = new RegExp(escaped, flags)
  } catch {
    return []
  }

  doc.descendants((node, pos) => {
    if (!node.isText) return
    const text = node.text
    let match
    while ((match = regex.exec(text)) !== null) {
      results.push({ from: pos + match.index, to: pos + match.index + match[0].length })
      if (!match[0].length) break
    }
  })

  return results
}

function buildDecorations(doc, results, resultIndex) {
  if (!results.length) return DecorationSet.empty

  const decorations = results.map((r, i) => {
    const cls = i === resultIndex ? 'search-highlight search-highlight-current' : 'search-highlight'
    return Decoration.inline(r.from, r.to, { class: cls })
  })

  return DecorationSet.create(doc, decorations)
}

const SearchReplace = Extension.create({
  name: 'searchReplace',

  addStorage() {
    return {
      searchTerm: '',
      replaceTerm: '',
      caseSensitive: false,
      results: [],
      resultIndex: 0,
    }
  },

  addCommands() {
    return {
      setSearchTerm: (term) => ({ editor, dispatch }) => {
        if (dispatch) {
          editor.storage.searchReplace.searchTerm = term
          const { doc } = editor.state
          const results = findMatches(doc, term, editor.storage.searchReplace.caseSensitive)
          editor.storage.searchReplace.results = results
          // clamp index
          const idx = editor.storage.searchReplace.resultIndex
          editor.storage.searchReplace.resultIndex = results.length ? Math.min(idx, results.length - 1) : 0

          // trigger a decoration refresh via a dummy transaction
          const { tr } = editor.state
          tr.setMeta(searchReplacePluginKey, { refresh: true })
          editor.view.dispatch(tr)
        }
        return true
      },

      setReplaceTerm: (term) => ({ editor }) => {
        editor.storage.searchReplace.replaceTerm = term
        return true
      },

      setCaseSensitive: (value) => ({ editor }) => {
        editor.storage.searchReplace.caseSensitive = value
        // recompute results
        const { doc } = editor.state
        const results = findMatches(doc, editor.storage.searchReplace.searchTerm, value)
        editor.storage.searchReplace.results = results
        const idx = editor.storage.searchReplace.resultIndex
        editor.storage.searchReplace.resultIndex = results.length ? Math.min(idx, results.length - 1) : 0

        const { tr } = editor.state
        tr.setMeta(searchReplacePluginKey, { refresh: true })
        editor.view.dispatch(tr)
        return true
      },

      goToNextResult: () => ({ editor }) => {
        const { results, resultIndex } = editor.storage.searchReplace
        if (!results.length) return false
        const next = (resultIndex + 1) % results.length
        editor.storage.searchReplace.resultIndex = next

        const { tr } = editor.state
        tr.setMeta(searchReplacePluginKey, { refresh: true })
        editor.view.dispatch(tr)

        // scroll into view
        const match = results[next]
        if (match) {
          const dom = editor.view.domAtPos(match.from)
          if (dom?.node) {
            const el = dom.node.nodeType === 3 ? dom.node.parentElement : dom.node
            el?.scrollIntoView?.({ block: 'center', behavior: 'smooth' })
          }
        }
        return true
      },

      goToPrevResult: () => ({ editor }) => {
        const { results, resultIndex } = editor.storage.searchReplace
        if (!results.length) return false
        const prev = (resultIndex - 1 + results.length) % results.length
        editor.storage.searchReplace.resultIndex = prev

        const { tr } = editor.state
        tr.setMeta(searchReplacePluginKey, { refresh: true })
        editor.view.dispatch(tr)

        const match = results[prev]
        if (match) {
          const dom = editor.view.domAtPos(match.from)
          if (dom?.node) {
            const el = dom.node.nodeType === 3 ? dom.node.parentElement : dom.node
            el?.scrollIntoView?.({ block: 'center', behavior: 'smooth' })
          }
        }
        return true
      },

      replaceCurrentResult: () => ({ editor }) => {
        const { results, resultIndex, replaceTerm } = editor.storage.searchReplace
        if (!results.length) return false
        const match = results[resultIndex]
        if (!match) return false

        const { tr } = editor.state
        tr.insertText(replaceTerm, match.from, match.to)
        editor.view.dispatch(tr)

        // recompute
        const newResults = findMatches(editor.state.doc, editor.storage.searchReplace.searchTerm, editor.storage.searchReplace.caseSensitive)
        editor.storage.searchReplace.results = newResults
        editor.storage.searchReplace.resultIndex = newResults.length
          ? Math.min(resultIndex, newResults.length - 1)
          : 0

        const { tr: tr2 } = editor.state
        tr2.setMeta(searchReplacePluginKey, { refresh: true })
        editor.view.dispatch(tr2)
        return true
      },

      replaceAll: () => ({ editor }) => {
        const { results, replaceTerm } = editor.storage.searchReplace
        if (!results.length) return false

        // apply replacements in reverse order to keep positions valid
        const { tr } = editor.state
        const sorted = [...results].sort((a, b) => b.from - a.from)
        for (const match of sorted) {
          tr.insertText(replaceTerm, match.from, match.to)
        }
        editor.view.dispatch(tr)

        // recompute
        const newResults = findMatches(editor.state.doc, editor.storage.searchReplace.searchTerm, editor.storage.searchReplace.caseSensitive)
        editor.storage.searchReplace.results = newResults
        editor.storage.searchReplace.resultIndex = 0

        const { tr: tr2 } = editor.state
        tr2.setMeta(searchReplacePluginKey, { refresh: true })
        editor.view.dispatch(tr2)
        return true
      },
    }
  },

  addProseMirrorPlugins() {
    const extensionThis = this

    return [
      new Plugin({
        key: searchReplacePluginKey,
        state: {
          init() {
            return DecorationSet.empty
          },
          apply(tr, oldDecorations) {
            if (tr.getMeta(searchReplacePluginKey)?.refresh) {
              const { results, resultIndex } = extensionThis.storage
              return buildDecorations(tr.doc, results, resultIndex)
            }
            // if doc changed (e.g. typing), remap decorations
            if (tr.docChanged) {
              const { searchTerm, caseSensitive } = extensionThis.storage
              if (searchTerm) {
                const results = findMatches(tr.doc, searchTerm, caseSensitive)
                extensionThis.storage.results = results
                const idx = extensionThis.storage.resultIndex
                extensionThis.storage.resultIndex = results.length ? Math.min(idx, results.length - 1) : 0
                return buildDecorations(tr.doc, results, extensionThis.storage.resultIndex)
              }
              return DecorationSet.empty
            }
            return oldDecorations
          },
        },
        props: {
          decorations(state) {
            return this.getState(state)
          },
        },
      }),
    ]
  },
})

export default SearchReplace
