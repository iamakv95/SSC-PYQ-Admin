import MarkdownIt from 'markdown-it'
import katex from 'katex'

// Admin's own preview uses markdown-it + KaTeX in the browser (admin doc §10) — the app side
// renders the same markdown-lite string with react-native-enriched-markdown instead, a
// different engine, but both target the identical narrow source format so the two stay
// visually consistent without needing to share code across a web/React Native boundary.
const md = new MarkdownIt({ html: false, linkify: false, breaks: false })

// markdown-it's default emphasis rule treats `_text_` as italic (CommonMark's own
// underscore-emphasis behavior) — but markdownLite.ts reserves `_..._` exclusively for underline
// (never emits it for italic, which is always `*text*`), so left alone this preview would show
// underlined admin content as italic instead, mismatching the app's real
// react-native-enriched-markdown render. Confirmed via markdown-it's own source
// (rules_inline/emphasis.ts) that em_open/em_close tokens carry `markup: '_'` specifically when
// produced by an underscore delimiter (vs `markup: '*'` for asterisk) — overriding just those two
// render rules for the underscore case is enough; asterisk-italic and nested bold/math are
// untouched and fall through to the default renderer.
md.renderer.rules.em_open = (tokens, idx, options, _env, self) =>
  tokens[idx].markup === '_' ? '<u>' : self.renderToken(tokens, idx, options)
md.renderer.rules.em_close = (tokens, idx, options, _env, self) =>
  tokens[idx].markup === '_' ? '</u>' : self.renderToken(tokens, idx, options)

export function renderMarkdownLitePreview(source: string): string {
  if (!source) return ''

  // markdown-it has no built-in math support — render $expr$ via KaTeX first, swap each result
  // in behind a placeholder token so markdown-it's own inline parser (which would otherwise try
  // to interpret stray `$`/`\` characters as plain text, harmlessly, but unpredictably) never
  // sees the raw LaTeX at all, then substitute the real KaTeX HTML back in after rendering.
  const mathHtml: string[] = []
  const withPlaceholders = source.replace(/\$([^$]+)\$/g, (_match, expr: string) => {
    let html: string
    try {
      html = katex.renderToString(expr, { throwOnError: false })
    } catch {
      html = expr
    }
    mathHtml.push(html)
    return `%%MATH_${mathHtml.length - 1}%%`
  })

  const rendered = md.render(withPlaceholders)
  return rendered.replace(/%%MATH_(\d+)%%/g, (_match, index: string) => mathHtml[Number(index)] ?? '')
}
