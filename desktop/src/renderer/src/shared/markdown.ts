/**
 * Minimal Markdown → HTML renderer for AI-generated documents (meeting
 * minutes). Deliberately tiny and dependency-free: it only covers what the
 * minutes prompt actually asks for — headings, bullets, pipe tables, bold and
 * inline code.
 *
 * Everything is HTML-escaped up front, so the model's output can never inject
 * markup into the app, and the inline rules only ever add tags of their own.
 */

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function renderInline(text: string): string {
  return escapeHtml(text)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[\s(])\*([^*]+)\*/g, '$1<em>$2</em>')
}

function isTableSeparator(line: string): boolean {
  return /^\s*\|?[\s:-]*-[\s|:-]*\|?\s*$/.test(line) && line.includes('-')
}

function splitTableRow(line: string): string[] {
  return line
    .replace(/^\s*\|/, '')
    .replace(/\|\s*$/, '')
    .split('|')
    .map((cell) => cell.trim())
}

export function renderMarkdown(source: string): string {
  const lines = source.replace(/\r\n/g, '\n').split('\n')
  const html: string[] = []
  let listItems: string[] = []
  let paragraph: string[] = []

  function flushList(): void {
    if (!listItems.length) return
    html.push(`<ul>${listItems.map((item) => `<li>${item}</li>`).join('')}</ul>`)
    listItems = []
  }

  function flushParagraph(): void {
    if (!paragraph.length) return
    html.push(`<p>${paragraph.join('<br>')}</p>`)
    paragraph = []
  }

  function flushAll(): void {
    flushList()
    flushParagraph()
  }

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]

    if (!line.trim()) {
      flushAll()
      continue
    }

    const heading = /^(#{1,6})\s+(.*)$/.exec(line)
    if (heading) {
      flushAll()
      const level = Math.min(heading[1].length + 1, 6)
      html.push(`<h${level}>${renderInline(heading[2])}</h${level}>`)
      continue
    }

    if (line.includes('|') && isTableSeparator(lines[index + 1] ?? '')) {
      flushAll()
      const headers = splitTableRow(line)
      const rows: string[][] = []
      index += 2
      while (index < lines.length && lines[index].includes('|')) {
        rows.push(splitTableRow(lines[index]))
        index++
      }
      index--

      html.push(
        '<table><thead><tr>' +
          headers.map((cell) => `<th>${renderInline(cell)}</th>`).join('') +
          '</tr></thead><tbody>' +
          rows
            .map((row) => `<tr>${row.map((cell) => `<td>${renderInline(cell)}</td>`).join('')}</tr>`)
            .join('') +
          '</tbody></table>'
      )
      continue
    }

    const bullet = /^\s*[-*+]\s+(.*)$/.exec(line)
    if (bullet) {
      flushParagraph()
      listItems.push(renderInline(bullet[1]))
      continue
    }

    const numbered = /^\s*\d+[.)]\s+(.*)$/.exec(line)
    if (numbered) {
      flushParagraph()
      listItems.push(renderInline(numbered[1]))
      continue
    }

    flushList()
    paragraph.push(renderInline(line))
  }

  flushAll()
  return html.join('')
}
