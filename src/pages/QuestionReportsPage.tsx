import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, Pencil, RotateCcw } from 'lucide-react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { Button } from '../components/fields'
import { DataTable, type ColumnDef } from '../components/DataTable'
import {
  questionReportsApi,
  type QuestionReport,
  type ReportReason,
  type ReportStatus,
} from '../lib/api/questionReports'

const REASON_LABELS: Record<ReportReason, string> = {
  wrong_answer: 'Wrong answer',
  unclear_text: 'Unclear text',
  duplicate: 'Duplicate',
  other: 'Other',
}

function questionPreview(report: QuestionReport): string {
  const raw = report.questions?.text.en?.value || report.questions?.text.hi?.value || ''
  const plain = raw.replace(/!\[[^\]]*\]\([^)]+\)/g, '[image]').replace(/[*$]/g, '')
  return plain || '(question text unavailable)'
}

function formatDate(value: string | null): string {
  if (!value) return '—'
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

export function QuestionReportsPage() {
  const queryClient = useQueryClient()
  const [status, setStatus] = useState<ReportStatus | 'all'>('open')
  const listQuery = useQuery({
    queryKey: ['questionReports', status],
    queryFn: () => questionReportsApi.list(status),
  })

  const statusMutation = useMutation({
    mutationFn: ({ id, nextStatus }: { id: string; nextStatus: ReportStatus }) =>
      questionReportsApi.setStatus(id, nextStatus),
    onSuccess: (_, variables) => {
      toast.success(variables.nextStatus === 'resolved' ? 'Report resolved.' : 'Report reopened.')
      queryClient.invalidateQueries({ queryKey: ['questionReports'] })
      queryClient.invalidateQueries({ queryKey: ['adminOverview'] })
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Something went wrong.'),
  })

  const columns: ColumnDef<QuestionReport>[] = [
    {
      id: 'question',
      header: 'Question',
      className: 'w-full max-w-0',
      cell: ({ row }) => {
        const preview = questionPreview(row.original)
        return (
          <div className="min-w-0">
            <span className="block truncate font-medium text-slate-900" title={preview}>
              {preview}
            </span>
            <span className="text-xs text-slate-400">
              {row.original.questions?.type ?? 'Unknown'} · {row.original.questions?.difficulty ?? 'Unknown'}
            </span>
          </div>
        )
      },
    },
    {
      id: 'reason',
      header: 'Reason',
      className: 'w-px',
      cell: ({ row }) => REASON_LABELS[row.original.reason],
    },
    {
      id: 'note',
      header: 'Note',
      className: 'w-64 max-w-64',
      cell: ({ row }) => (
        <span className="block truncate text-slate-600" title={row.original.note ?? ''}>
          {row.original.note || '—'}
        </span>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      className: 'w-px capitalize',
    },
    {
      id: 'reported',
      header: 'Reported',
      className: 'w-px',
      cell: ({ row }) => formatDate(row.original.created_at),
    },
    {
      id: 'actions',
      header: '',
      className: 'w-px',
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <Link
            to={`/questions?edit=${row.original.question_id}`}
            aria-label="Edit reported question"
            title="Edit question"
            className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100"
          >
            <Pencil aria-hidden="true" size={16} />
          </Link>
          <Button
            variant="ghost"
            className="!p-1.5"
            disabled={statusMutation.isPending}
            aria-label={row.original.status === 'open' ? 'Resolve report' : 'Reopen report'}
            title={row.original.status === 'open' ? 'Resolve' : 'Reopen'}
            onClick={() =>
              statusMutation.mutate({
                id: row.original.id,
                nextStatus: row.original.status === 'open' ? 'resolved' : 'open',
              })
            }
          >
            {row.original.status === 'open' ? (
              <CheckCircle2 aria-hidden="true" size={16} />
            ) : (
              <RotateCcw aria-hidden="true" size={16} />
            )}
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div>
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Question Reports</h1>
          <p className="mt-1 text-sm text-slate-500">Review issues submitted from the mobile app.</p>
        </div>
        <div className="flex rounded-md border border-slate-200 bg-white p-1">
          {(['open', 'resolved', 'all'] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setStatus(value)}
              className={`rounded px-3 py-1.5 text-sm font-medium capitalize ${
                status === value ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-100'
              }`}
            >
              {value}
            </button>
          ))}
        </div>
      </div>

      {listQuery.isLoading ? (
        <p className="text-sm text-slate-400">Loading reports…</p>
      ) : listQuery.isError ? (
        <p className="text-sm text-red-600">{listQuery.error.message}</p>
      ) : (
        <>
          <p className="mb-2 text-sm text-slate-500">{listQuery.data?.total ?? 0} reports</p>
          <DataTable
            columns={columns}
            data={listQuery.data?.items ?? []}
            emptyMessage={`No ${status === 'all' ? '' : `${status} `}reports.`}
            fitContainer
          />
        </>
      )}
    </div>
  )
}
