import { mergeAttributes, Node, type NodeViewProps } from '@tiptap/core'
import { NodeViewWrapper, ReactNodeViewRenderer } from '@tiptap/react'
import katex from 'katex'
import 'katex/dist/katex.min.css'

function renderKatex(latex: string): string {
  try {
    return katex.renderToString(latex || '\\text{math}', { throwOnError: false })
  } catch {
    return latex
  }
}

function MathComponent({ node, updateAttributes }: NodeViewProps) {
  const latex = (node.attrs.latex as string) ?? ''

  function handleClick() {
    // Deliberately a plain prompt() rather than a custom popover — this is an internal admin
    // tool, not a consumer product, and a full inline-editing UI for LaTeX source isn't worth
    // the added complexity here.
    const next = window.prompt('Edit math (LaTeX):', latex)
    if (next !== null) updateAttributes({ latex: next })
  }

  return (
    <NodeViewWrapper
      as="span"
      className="mx-0.5 inline-block cursor-pointer rounded bg-indigo-50 px-1 align-middle hover:bg-indigo-100"
      onClick={handleClick}
      title="Click to edit LaTeX"
    >
      <span dangerouslySetInnerHTML={{ __html: renderKatex(latex) }} />
    </NodeViewWrapper>
  )
}

/** Inline math node (admin doc §10 — "$expression$ (KaTeX-compatible delimiter)"). Atomic (not
 * further editable as text) — editing happens via the click-to-prompt handler above, keeping
 * the LaTeX source itself out of the normal text flow where stray `$` characters could
 * otherwise get mangled by the bold/italic tokenizer in markdownLite.ts. */
export const MathNode = Node.create({
  name: 'math',
  group: 'inline',
  inline: true,
  atom: true,

  addAttributes() {
    return {
      latex: { default: '' },
    }
  },

  parseHTML() {
    return [{ tag: 'span[data-math]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, { 'data-math': '' })]
  },

  addNodeView() {
    return ReactNodeViewRenderer(MathComponent)
  },
})
