import { useState, type ReactNode } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'

interface ArchivedSectionProps {
  count: number
  children: ReactNode
}

/**
 * "Show archived (N)" toggle + dimmed sub-table with Restore actions — admin doc §7, applies
 * identically to every entity (Exam, Subject, Topic, Subtopic, Concept Tag, Question, Fixed
 * Quiz). Children render lazily (only once expanded) — the archived list itself is still fetched
 * eagerly by the caller (needed for the count), this just avoids rendering a possibly-large
 * dimmed table before anyone asks to see it.
 */
export function ArchivedSection({ count, children }: ArchivedSectionProps) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="mt-6">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700"
      >
        {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        Show archived ({count})
      </button>
      {expanded && <div className="mt-3">{children}</div>}
    </div>
  )
}
