import { useRef } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import { TableKit } from '@tiptap/extension-table'
import Underline from '@tiptap/extension-underline'
import { Bold, Image as ImageIcon, Italic, List, ListOrdered, Sigma, Table2, Trash2, Underline as UnderlineIcon } from 'lucide-react'
import { toast } from 'sonner'
import { parseMarkdownLite, serializeToMarkdownLite } from '../../lib/richtext/markdownLite'
import { MathNode } from '../../lib/richtext/MathNode'
import { uploadImage, type ImageBucket } from '../../lib/api/upload'

interface RichTextEditorProps {
  value: string
  onChange: (value: string) => void
  /** Which Storage bucket inline images upload to — always question-images for this form
   * (admin doc §10); kept as a prop rather than hardcoded so this component stays reusable. */
  imageBucket?: ImageBucket
  /** Tables are deliberately available only for question text, never passages/explanations. */
  allowTables?: boolean
}

/**
 * Tiptap editor for Question text / Explanation / Passage (admin doc §10) — Bold, Italic,
 * Underline, Image, ordered/unordered lists, optional question-only tables, and the custom Math
 * node. Value is always a markdown-lite string in and out; unsupported block types such as
 * headings, blockquotes, and code blocks remain disabled.
 * Underline isn't part of StarterKit at all (unlike bold/italic), hence the separate
 * @tiptap/extension-underline import — its mark type is literally named 'underline', which is
 * what markdownLite.ts's serializer/parser already key off of.
 */
export function RichTextEditor({ value, onChange, imageBucket = 'question-images', allowTables = false }: RichTextEditorProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        blockquote: false,
        codeBlock: false,
        horizontalRule: false,
        strike: false,
        code: false,
      }),
      // inline: true is required — @tiptap/extension-image defaults to a BLOCK-level node,
      // which serializeToMarkdownLite (markdownLite.ts) never sees: it only walks each top-level
      // node's own `.content` assuming every one is a paragraph, so a block-level image (a leaf
      // node with no `.content`) silently serializes to '' and the ![alt](url) is never written
      // out on save — confirmed live: uploaded files exist in Storage, but zero saved questions
      // ever contained a ![...] string. Inline mode nests the image inside the paragraph's own
      // content array instead, where the serializer (and parseMarkdownLite's INLINE_TOKEN, which
      // already expects images inline) both already handle it correctly.
      Image.configure({ inline: true }),
      Underline,
      MathNode,
      ...(allowTables ? [TableKit.configure({ table: { resizable: true } })] : []),
    ],
    content: parseMarkdownLite(value, { allowTables }),
    onUpdate: ({ editor }) => {
      onChange(serializeToMarkdownLite(editor.getJSON(), { allowTables }))
    },
    editorProps: {
      attributes: {
        // `prose`/`prose-sm` were dead weight here — @tailwindcss/typography was never
        // installed (confirmed: not in package.json, and the served dev CSS has zero `.prose`
        // rules), so those classes emitted no CSS at all while Tailwind Preflight's `margin: 0`
        // reset left every <p> flush against its neighbor. Paragraph spacing now comes from the
        // targeted `.ProseMirror p + p` rule in index.css instead of a whole typography plugin
        // we don't need (headings/lists/blockquote are disabled in this schema anyway).
        class: 'max-w-none min-h-24 px-3 py-2 text-sm text-slate-900 focus:outline-none',
      },
    },
  }, [allowTables])

  async function handleImageFile(file: File) {
    if (!editor) return
    try {
      const url = await uploadImage(imageBucket, file)
      editor.chain().focus().setImage({ src: url, alt: file.name }).run()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Image upload failed.')
    }
  }

  if (!editor) return null

  return (
    <div className="rounded-md border border-slate-300 focus-within:border-slate-500">
      <div className="flex items-center gap-1 border-b border-slate-200 px-2 py-1.5">
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={`rounded p-1.5 hover:bg-slate-100 ${editor.isActive('bold') ? 'bg-slate-200' : ''}`}
          title="Bold"
        >
          <Bold size={15} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`rounded p-1.5 hover:bg-slate-100 ${editor.isActive('italic') ? 'bg-slate-200' : ''}`}
          title="Italic"
        >
          <Italic size={15} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          className={`rounded p-1.5 hover:bg-slate-100 ${editor.isActive('underline') ? 'bg-slate-200' : ''}`}
          title="Underline"
        >
          <UnderlineIcon size={15} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`rounded p-1.5 hover:bg-slate-100 ${editor.isActive('bulletList') ? 'bg-slate-200' : ''}`}
          title="Bullet list"
        >
          <List size={15} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={`rounded p-1.5 hover:bg-slate-100 ${editor.isActive('orderedList') ? 'bg-slate-200' : ''}`}
          title="Numbered list"
        >
          <ListOrdered size={15} />
        </button>
        {allowTables && !editor.isActive('table') && (
          <button
            type="button"
            onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
            className="rounded p-1.5 hover:bg-slate-100"
            title="Insert 3 × 3 table"
          >
            <Table2 size={15} />
          </button>
        )}
        {allowTables && editor.isActive('table') && (
          <>
            <button type="button" onClick={() => editor.chain().focus().addRowAfter().run()} className="rounded px-2 py-1 text-xs hover:bg-slate-100" title="Add row after">
              Row +
            </button>
            <button type="button" onClick={() => editor.chain().focus().deleteRow().run()} className="rounded px-2 py-1 text-xs hover:bg-slate-100" title="Delete current row">
              Row −
            </button>
            <button type="button" onClick={() => editor.chain().focus().addColumnAfter().run()} className="rounded px-2 py-1 text-xs hover:bg-slate-100" title="Add column after">
              Col +
            </button>
            <button type="button" onClick={() => editor.chain().focus().deleteColumn().run()} className="rounded px-2 py-1 text-xs hover:bg-slate-100" title="Delete current column">
              Col −
            </button>
            <button type="button" onClick={() => editor.chain().focus().deleteTable().run()} className="rounded p-1.5 text-red-600 hover:bg-red-50" title="Delete table">
              <Trash2 size={15} />
            </button>
          </>
        )}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="rounded p-1.5 hover:bg-slate-100"
          title="Insert image"
        >
          <ImageIcon size={15} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().insertContent({ type: 'math', attrs: { latex: 'x^2' } }).run()}
          className="rounded p-1.5 hover:bg-slate-100"
          title="Insert math"
        >
          <Sigma size={15} />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) void handleImageFile(file)
            e.target.value = ''
          }}
        />
      </div>
      <EditorContent editor={editor} />
    </div>
  )
}
