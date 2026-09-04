import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { CheckCircle2, Clock, Eye } from 'lucide-react'
import { DataTable, type ColumnDef } from '../components/DataTable'
import { Button } from '../components/fields'
import {
  appFeedbackApi,
  type AppFeedback,
  type FeedbackCategory,
  type FeedbackStatus,
} from '../lib/api/appFeedback'

function formatDate(value: string | null): string {
  if (!value) return '—'
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

const CATEGORY_LABELS: Record<FeedbackCategory, { label: string; badgeClass: string }> = {
  suggestion: { label: '💡 Suggestion', badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  bug: { label: '🐞 Bug', badgeClass: 'bg-rose-50 text-rose-700 border-rose-200' },
  ui: { label: '📱 UI / Speed', badgeClass: 'bg-sky-50 text-sky-700 border-sky-200' },
  general: { label: '💬 General', badgeClass: 'bg-slate-100 text-slate-700 border-slate-200' },
}

const STATUS_BADGES: Record<FeedbackStatus, { label: string; badgeClass: string }> = {
  new: { label: 'New', badgeClass: 'bg-amber-50 text-amber-700 border-amber-200' },
  reviewed: { label: 'Reviewed', badgeClass: 'bg-blue-50 text-blue-700 border-blue-200' },
  resolved: { label: 'Resolved', badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
}

export function AppFeedbackPage() {
  const queryClient = useQueryClient()
  const [status, setStatus] = useState<FeedbackStatus | 'all'>('all')
  const [category, setCategory] = useState<FeedbackCategory | 'all'>('all')
  const [page, setPage] = useState(0)

  const listQuery = useQuery({
    queryKey: ['appFeedback', status, category, page],
    queryFn: () => appFeedbackApi.list(status, category, page, 50),
  })

  const statusMutation = useMutation({
    mutationFn: ({ id, nextStatus }: { id: string; nextStatus: FeedbackStatus }) =>
      appFeedbackApi.setStatus(id, nextStatus),
    onSuccess: (_, vars) => {
      toast.success(`Feedback marked as ${vars.nextStatus}.`)
      queryClient.invalidateQueries({ queryKey: ['appFeedback'] })
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to update status.'),
  })

  const columns: ColumnDef<AppFeedback>[] = [
    {
      id: 'category',
      header: 'Category',
      className: 'w-px whitespace-nowrap',
      cell: ({ row }) => {
        const cat = CATEGORY_LABELS[row.original.category] ?? { label: row.original.category, badgeClass: 'bg-slate-100 text-slate-700' }
        return (
          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border ${cat.badgeClass}`}>
            {cat.label}
          </span>
        )
      },
    },
    {
      id: 'message',
      header: 'Feedback Message',
      className: 'w-full min-w-[300px]',
      cell: ({ row }) => (
        <p className="whitespace-pre-wrap text-sm text-slate-900 leading-relaxed max-w-2xl py-1">
          {row.original.message}
        </p>
      ),
    },
    {
      id: 'meta',
      header: 'App / Device',
      className: 'w-px whitespace-nowrap text-xs text-slate-500',
      cell: ({ row }) => (
        <div>
          <span className="font-medium text-slate-700">v{row.original.app_version ?? '1.0.5'}</span>
          <span className="block text-slate-400">{row.original.device_info ?? '—'}</span>
        </div>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      className: 'w-px whitespace-nowrap',
      cell: ({ row }) => {
        const badge = STATUS_BADGES[row.original.status] ?? { label: row.original.status, badgeClass: 'bg-slate-100 text-slate-700' }
        return (
          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium border ${badge.badgeClass}`}>
            {badge.label}
          </span>
        )
      },
    },
    {
      id: 'created_at',
      header: 'Date',
      className: 'w-px whitespace-nowrap text-xs text-slate-400',
      cell: ({ row }) => formatDate(row.original.created_at),
    },
    {
      id: 'actions',
      header: '',
      className: 'w-px whitespace-nowrap text-right',
      cell: ({ row }) => {
        const current = row.original.status
        return (
          <div className="flex items-center justify-end gap-1.5">
            {current === 'new' && (
              <Button
                variant="secondary"
                className="!py-1 !px-2 !text-xs"
                title="Mark as Reviewed"
                onClick={() => statusMutation.mutate({ id: row.original.id, nextStatus: 'reviewed' })}
              >
                <Eye size={13} className="mr-1 inline" />
                Reviewed
              </Button>
            )}
            {current !== 'resolved' ? (
              <Button
                variant="secondary"
                className="!py-1 !px-2 !text-xs text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                title="Mark as Resolved"
                onClick={() => statusMutation.mutate({ id: row.original.id, nextStatus: 'resolved' })}
              >
                <CheckCircle2 size={13} className="mr-1 inline text-emerald-600" />
                Resolve
              </Button>
            ) : (
              <Button
                variant="ghost"
                className="!py-1 !px-2 !text-xs text-slate-500 hover:text-slate-800"
                title="Reopen"
                onClick={() => statusMutation.mutate({ id: row.original.id, nextStatus: 'new' })}
              >
                <Clock size={13} className="mr-1 inline" />
                Reopen
              </Button>
            )}
          </div>
        )
      },
    },
  ]

  const total = listQuery.data?.total ?? 0

  return (
    <div>
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">App Feedback</h1>
          <p className="mt-1 text-sm text-slate-500">
            User-submitted suggestions, feature requests, UI comments, and general feedback.
          </p>
        </div>

        <div className="flex gap-2">
          {/* Status Filter */}
          <div className="flex rounded-md border border-slate-200 bg-white p-1 text-xs">
            {(['all', 'new', 'reviewed', 'resolved'] as const).map((s) => (
              <button
                key={s}
                onClick={() => {
                  setStatus(s)
                  setPage(0)
                }}
                className={`rounded px-3 py-1 font-medium capitalize transition-colors ${
                  status === s ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          {/* Category Filter */}
          <div className="flex rounded-md border border-slate-200 bg-white p-1 text-xs">
            {(['all', 'suggestion', 'bug', 'ui', 'general'] as const).map((c) => (
              <button
                key={c}
                onClick={() => {
                  setCategory(c)
                  setPage(0)
                }}
                className={`rounded px-2.5 py-1 font-medium capitalize transition-colors ${
                  category === c ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {c === 'all' ? 'All categories' : c}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mb-3 text-sm text-slate-500">
        {total} feedback {total === 1 ? 'submission' : 'submissions'}
      </div>

      <DataTable
        columns={columns}
        data={listQuery.data?.items ?? []}
        emptyMessage="No feedback found for the selected filters."
        fitContainer
      />
    </div>
  )
}
