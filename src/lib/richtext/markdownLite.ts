import type { JSONContent } from '@tiptap/react'

// Admin doc §10's deliberately narrow storage format: paragraphs, ordered/unordered lists,
// optional GFM tables for question text, Shift+Enter hard breaks, **bold**, *italic*,
// _underline_, inline images ![alt](url), and inline math $expression$ (KaTeX-compatible). No
// general markdown library is used for THIS conversion (only markdown-it for the read-only
// preview elsewhere) — the format is narrow enough that a small hand-written block parser plus
// inline tokenizer stays predictable.
//
// UNDERLINE SYNTAX: `_text_` — confirmed against react-native-enriched-markdown's own docs
// (ELEMENTS_STRUCTURE.md / API_REFERENCE.md), not guessed. The renderer treats `_text_` as
// italic by default (CommonMark's own underscore-emphasis rule) unless it's told otherwise via
// `md4cFlags={{ underline: true }}` (see mobile's RichText.tsx) — safe here because this
// serializer never emits underscore-delimited italics itself (italic is always `*text*`), so
// there's no existing content this reinterprets. The tradeoff is the same one CommonMark itself
// has: a literal underscore pair in real content (e.g. `some_var_name`) would be misread as an
// underline span — accepted as inherent to reusing the library's own chosen delimiter rather than
// inventing a non-standard one.
//
// COMBINED MARKS: bold+italic already serializes as `***text***` via sequential wrapping
// (bold's `**text**` re-wrapped by italic's `*...*`). Underline is wrapped outermost the same
// way, which is why the combined forms below nest in bold -> italic -> underline order:
// `_**text**_` (bold+underline), `_*text*_` (italic+underline), `_***text***_` (all three). The
// combined-form alternatives must come before the plain `\*\*`/`\*`/`_` alternatives in the
// regex so a wrapped run is matched as one token instead of its plain sub-pattern matching first
// and leaving stray underscores as literal text.

const INLINE_TOKEN =
  /!\[([^\]]*)\]\(([^)]+)\)|\$([^$]+)\$|_\*\*\*([^*_]+)\*\*\*_|_\*\*([^*_]+)\*\*_|_\*([^*_]+)\*_|\*\*\*([^*]+)\*\*\*|\*\*([^*]+)\*\*|\*([^*]+)\*|_([^_]+)_/g

function parseInlineSegment(text: string): JSONContent[] {
  const nodes: JSONContent[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null
  INLINE_TOKEN.lastIndex = 0

  while ((match = INLINE_TOKEN.exec(text))) {
    if (match.index > lastIndex) {
      nodes.push({ type: 'text', text: text.slice(lastIndex, match.index) })
    }
    if (match[1] !== undefined) {
      nodes.push({ type: 'image', attrs: { alt: match[1], src: match[2] } })
    } else if (match[3] !== undefined) {
      nodes.push({ type: 'math', attrs: { latex: match[3] } })
    } else if (match[4] !== undefined) {
      nodes.push({
        type: 'text',
        text: match[4],
        marks: [{ type: 'bold' }, { type: 'italic' }, { type: 'underline' }],
      })
    } else if (match[5] !== undefined) {
      nodes.push({ type: 'text', text: match[5], marks: [{ type: 'bold' }, { type: 'underline' }] })
    } else if (match[6] !== undefined) {
      nodes.push({ type: 'text', text: match[6], marks: [{ type: 'italic' }, { type: 'underline' }] })
    } else if (match[7] !== undefined) {
      nodes.push({ type: 'text', text: match[7], marks: [{ type: 'bold' }, { type: 'italic' }] })
    } else if (match[8] !== undefined) {
      nodes.push({ type: 'text', text: match[8], marks: [{ type: 'bold' }] })
    } else if (match[9] !== undefined) {
      nodes.push({ type: 'text', text: match[9], marks: [{ type: 'italic' }] })
    } else if (match[10] !== undefined) {
      nodes.push({ type: 'text', text: match[10], marks: [{ type: 'underline' }] })
    }
    lastIndex = INLINE_TOKEN.lastIndex
  }
  if (lastIndex < text.length) {
    nodes.push({ type: 'text', text: text.slice(lastIndex) })
  }

  // ProseMirror/Tiptap text nodes must be non-empty — drop any accidental empty runs.
  return nodes.filter((n) => n.type !== 'text' || (n.text && n.text.length > 0))
}

function parseParagraphInline(text: string): JSONContent[] {
  const lines = text.split('\\' + '\n')
  return lines.flatMap((line, index) => [
    ...(index > 0 ? [{ type: 'hardBreak' } satisfies JSONContent] : []),
    ...parseInlineSegment(line),
  ])
}

interface MarkdownLiteOptions {
  allowTables?: boolean
}

export function parseMarkdownLite(source: string, options: MarkdownLiteOptions = {}): JSONContent {
  const lines = source.replace(/\r\n?/g, '\n').split('\n')
  const content: JSONContent[] = []
  let index = 0

  while (index < lines.length) {
    if (!lines[index].trim()) {
      index += 1
      continue
    }

    if (options.allowTables && isTableStart(lines, index)) {
      const parsed = parseTable(lines, index)
      content.push(parsed.node)
      index = parsed.nextIndex
      continue
    }

    const marker = parseListMarker(lines[index])
    if (marker) {
      const parsed = parseList(lines, index, marker.indent, marker.ordered)
      content.push(parsed.node)
      index = parsed.nextIndex
      continue
    }

    const paragraphLines: string[] = []
    while (
      index < lines.length &&
      lines[index].trim() &&
      !parseListMarker(lines[index]) &&
      !(options.allowTables && isTableStart(lines, index))
    ) {
      paragraphLines.push(lines[index].trim())
      index += 1
    }
    content.push(makeParagraph(paragraphLines.join('\n')))
  }

  if (content.length === 0) {
    return { type: 'doc', content: [{ type: 'paragraph' }] }
  }
  return { type: 'doc', content }
}

function splitTableRow(line: string): string[] {
  let source = line.trim()
  if (source.startsWith('|')) source = source.slice(1)
  if (source.endsWith('|') && !source.endsWith('\\|')) source = source.slice(0, -1)

  const cells: string[] = []
  let cell = ''
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index]
    if (character === '\\' && source[index + 1] === '|') {
      cell += '|'
      index += 1
    } else if (character === '|') {
      cells.push(cell.trim())
      cell = ''
    } else {
      cell += character
    }
  }
  cells.push(cell.trim())
  return cells
}

function tableAlign(delimiter: string): 'left' | 'center' | 'right' | null {
  const value = delimiter.trim()
  if (!/^:?-{3,}:?$/.test(value)) return null
  if (value.startsWith(':') && value.endsWith(':')) return 'center'
  if (value.endsWith(':')) return 'right'
  if (value.startsWith(':')) return 'left'
  return null
}

function isTableStart(lines: string[], index: number): boolean {
  if (index + 1 >= lines.length || !lines[index].includes('|')) return false
  const headers = splitTableRow(lines[index])
  const delimiters = splitTableRow(lines[index + 1])
  return headers.length > 0 && headers.length === delimiters.length && delimiters.every((cell) => /^:?-{3,}:?$/.test(cell))
}

function makeTableCell(text: string, header: boolean, align: 'left' | 'center' | 'right' | null): JSONContent {
  return {
    type: header ? 'tableHeader' : 'tableCell',
    attrs: { align },
    content: [makeParagraph(text)],
  }
}

function parseTable(lines: string[], startIndex: number): { node: JSONContent; nextIndex: number } {
  const headers = splitTableRow(lines[startIndex])
  const aligns = splitTableRow(lines[startIndex + 1]).map(tableAlign)
  const rows: JSONContent[] = [
    {
      type: 'tableRow',
      content: headers.map((cell, index) => makeTableCell(cell, true, aligns[index] ?? null)),
    },
  ]
  let index = startIndex + 2

  while (index < lines.length && lines[index].trim() && lines[index].includes('|')) {
    const cells = splitTableRow(lines[index])
    rows.push({
      type: 'tableRow',
      content: headers.map((_, cellIndex) => makeTableCell(cells[cellIndex] ?? '', false, aligns[cellIndex] ?? null)),
    })
    index += 1
  }

  return { node: { type: 'table', content: rows }, nextIndex: index }
}

interface ListMarker {
  indent: number
  ordered: boolean
  start: number
  text: string
}

function parseListMarker(line: string): ListMarker | null {
  const match = /^(\s*)([-+*]|(\d+)[.)])\s+(.*)$/.exec(line)
  if (!match) return null
  return {
    indent: match[1].replace(/\t/g, '  ').length,
    ordered: match[3] !== undefined,
    start: match[3] ? Number(match[3]) : 1,
    text: match[4],
  }
}

function makeParagraph(text: string): JSONContent {
  const inline = parseParagraphInline(text.trim())
  return inline.length > 0 ? { type: 'paragraph', content: inline } : { type: 'paragraph' }
}

function parseList(
  lines: string[],
  startIndex: number,
  indent: number,
  ordered: boolean,
): { node: JSONContent; nextIndex: number } {
  const items: JSONContent[] = []
  const firstMarker = parseListMarker(lines[startIndex])
  let index = startIndex

  while (index < lines.length) {
    const marker = parseListMarker(lines[index])
    if (!marker || marker.indent !== indent || marker.ordered !== ordered) break

    const itemContent: JSONContent[] = [makeParagraph(marker.text)]
    index += 1

    while (index < lines.length) {
      if (!lines[index].trim()) {
        const nextNonBlank = lines.findIndex((line, candidate) => candidate > index && line.trim())
        if (nextNonBlank === -1) {
          index = lines.length
          break
        }
        const nextMarker = parseListMarker(lines[nextNonBlank])
        if (nextMarker && nextMarker.indent >= indent) {
          index = nextNonBlank
          continue
        }
        break
      }

      const nestedMarker = parseListMarker(lines[index])
      if (nestedMarker) {
        if (nestedMarker.indent <= indent) break
        const nested = parseList(lines, index, nestedMarker.indent, nestedMarker.ordered)
        itemContent.push(nested.node)
        index = nested.nextIndex
        continue
      }

      const leadingWhitespace = /^\s*/.exec(lines[index])?.[0].replace(/\t/g, '  ').length ?? 0
      if (leadingWhitespace <= indent) break
      const previous = itemContent[itemContent.length - 1]
      const previousMarkdown = previous?.type === 'paragraph' ? serializeParagraph(previous) : ''
      if (previousMarkdown.endsWith('\\')) {
        itemContent[itemContent.length - 1] = makeParagraph(`${previousMarkdown}\n${lines[index].trim()}`)
      } else {
        itemContent.push(makeParagraph(lines[index].trim()))
      }
      index += 1
    }

    items.push({ type: 'listItem', content: itemContent })
  }

  return {
    node: ordered
      ? { type: 'orderedList', attrs: { start: firstMarker?.start ?? 1 }, content: items }
      : { type: 'bulletList', content: items },
    nextIndex: index,
  }
}

function serializeInline(node: JSONContent): string {
  if (node.type === 'text') {
    let text = node.text ?? ''
    const marks = (node.marks ?? []).map((m) => m.type)
    if (marks.includes('bold')) text = `**${text}**`
    if (marks.includes('italic')) text = `*${text}*`
    if (marks.includes('underline')) text = `_${text}_`
    return text
  }
  if (node.type === 'image') {
    return `![${node.attrs?.alt ?? ''}](${node.attrs?.src ?? ''})`
  }
  if (node.type === 'math') {
    return `$${node.attrs?.latex ?? ''}$`
  }
  if (node.type === 'hardBreak') {
    return '\\' + '\n'
  }
  return ''
}

export function serializeToMarkdownLite(doc: JSONContent, options: MarkdownLiteOptions = {}): string {
  return (doc.content ?? [])
    .map((block) => serializeBlock(block, 0, options))
    .filter(Boolean)
    .join('\n\n')
    .trim()
}

function serializeParagraph(node: JSONContent): string {
  return (node.content ?? []).map(serializeInline).join('')
}

function serializeBlock(node: JSONContent, indent: number, options: MarkdownLiteOptions): string {
  if (node.type === 'paragraph') return `${' '.repeat(indent)}${serializeParagraph(node)}`
  if (node.type === 'bulletList' || node.type === 'orderedList') return serializeList(node, indent)
  if (node.type === 'table' && options.allowTables) return serializeTable(node)
  return ''
}

function serializeTableCell(cell: JSONContent): string {
  return (cell.content ?? [])
    .map((block) => {
      if (block.type === 'paragraph') return serializeParagraph(block)
      if (block.type === 'bulletList' || block.type === 'orderedList') return serializeList(block, 0).replace(/\n+/g, '; ')
      return ''
    })
    .filter(Boolean)
    .join(' ')
    // GFM table rows cannot span physical lines; keep a table-cell Shift+Enter readable without
    // corrupting the row structure. Outside tables it remains a real hard break.
    .split('\\' + '\n')
    .join(' ')
    .replace(/\|/g, '\\|')
}

function serializeTable(node: JSONContent): string {
  const rows = node.content ?? []
  if (rows.length === 0) return ''
  const columnCount = Math.max(...rows.map((row) => row.content?.length ?? 0))
  if (columnCount === 0) return ''

  const renderRow = (row: JSONContent | undefined) => {
    const cells = row?.content ?? []
    return `| ${Array.from({ length: columnCount }, (_, index) => serializeTableCell(cells[index] ?? {})).join(' | ')} |`
  }
  const headerCells = rows[0].content ?? []
  const delimiter = `| ${Array.from({ length: columnCount }, (_, index) => {
    const align = headerCells[index]?.attrs?.align
    if (align === 'center') return ':---:'
    if (align === 'right') return '---:'
    if (align === 'left') return ':---'
    return '---'
  }).join(' | ')} |`

  return [renderRow(rows[0]), delimiter, ...rows.slice(1).map(renderRow)].join('\n')
}

function serializeList(node: JSONContent, indent: number): string {
  const ordered = node.type === 'orderedList'
  const start = Number(node.attrs?.start ?? 1)

  return (node.content ?? [])
    .map((item, itemIndex) => {
      const marker = ordered ? `${start + itemIndex}. ` : '- '
      const childIndent = indent + marker.length
      const children = item.content ?? []
      const firstParagraphIndex = children.findIndex((child) => child.type === 'paragraph')
      const firstText = firstParagraphIndex >= 0
        ? serializeParagraph(children[firstParagraphIndex]).split('\n').join(`\n${' '.repeat(childIndent)}`)
        : ''
      const lines = [`${' '.repeat(indent)}${marker}${firstText}`]

      children.forEach((child, childIndex) => {
        if (childIndex === firstParagraphIndex) return
        if (child.type === 'paragraph') {
          lines.push('', `${' '.repeat(childIndent)}${serializeParagraph(child)}`)
        } else if (child.type === 'bulletList' || child.type === 'orderedList') {
          lines.push(serializeList(child, childIndent))
        }
      })
      return lines.join('\n')
    })
    .join('\n')
}
