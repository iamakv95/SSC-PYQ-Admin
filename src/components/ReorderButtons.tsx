import { ArrowDown, ArrowUp } from 'lucide-react'

interface ReorderButtonsProps {
  onUp: () => void
  onDown: () => void
  disableUp: boolean
  disableDown: boolean
  /** True while a reorder request for this row (or a neighbor swapped by it) is in flight. */
  busy?: boolean
}

/** Manual up/down reorder control for the 4 display_order-backed entity lists (Exams, Subjects,
 * Topics, Subtopics) — same visual pattern as FixedQuizForm's question reordering (admin doc
 * §3), extracted here since it's now shared across 4 separate page files rather than looped
 * within just one. */
export function ReorderButtons({ onUp, onDown, disableUp, disableDown, busy = false }: ReorderButtonsProps) {
  return (
    <div className="flex gap-1">
      <button
        type="button"
        onClick={onUp}
        disabled={disableUp || busy}
        className="rounded p-1 text-slate-400 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent"
      >
        <ArrowUp size={14} />
      </button>
      <button
        type="button"
        onClick={onDown}
        disabled={disableDown || busy}
        className="rounded p-1 text-slate-400 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent"
      >
        <ArrowDown size={14} />
      </button>
    </div>
  )
}
