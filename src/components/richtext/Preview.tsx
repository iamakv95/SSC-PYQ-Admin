import 'katex/dist/katex.min.css'
import { renderMarkdownLitePreview } from '../../lib/richtext/renderPreview'

export function Preview({ source }: { source: string }) {
  if (!source.trim()) {
    return <p className="text-sm italic text-slate-400">Nothing to preview.</p>
  }
  // Trusted admin-authored content, rendered the same way the app-side markdown-lite renderer
  // would display it.
  return <div className="markdown-preview max-w-none" dangerouslySetInnerHTML={{ __html: renderMarkdownLitePreview(source) }} />
}
