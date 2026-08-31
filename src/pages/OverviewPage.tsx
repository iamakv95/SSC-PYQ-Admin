import { useQuery } from '@tanstack/react-query'
import { BookOpenText, FileQuestion, Flag, Users, Workflow } from 'lucide-react'
import { Link } from 'react-router-dom'
import { overviewApi } from '../lib/api/overview'

function SummaryCard({
  label,
  value,
  to,
  icon: Icon,
  urgent = false,
}: {
  label: string
  value: number
  to: string
  icon: typeof FileQuestion
  urgent?: boolean
}) {
  return (
    <Link to={to} className="rounded-lg border border-slate-200 bg-white p-5 transition-colors hover:border-slate-300">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className={`mt-2 text-3xl font-semibold ${urgent && value > 0 ? 'text-red-600' : 'text-slate-900'}`}>{value}</p>
        </div>
        <span className={`rounded-lg p-2 ${urgent && value > 0 ? 'bg-red-50 text-red-600' : 'bg-slate-100 text-slate-600'}`}>
          <Icon size={20} />
        </span>
      </div>
    </Link>
  )
}

function ContentBreakdown({
  title,
  values,
  to,
}: {
  title: string
  values: { draft: number; published: number; inactive: number }
  to: string
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-semibold text-slate-900">{title}</h2>
        <Link to={to} className="text-sm font-medium text-slate-500 hover:text-slate-900">View all</Link>
      </div>
      <div className="grid grid-cols-3 divide-x divide-slate-100">
        <div><p className="text-2xl font-semibold text-slate-900">{values.published}</p><p className="text-xs text-slate-500">Published</p></div>
        <div className="pl-4"><p className="text-2xl font-semibold text-slate-900">{values.draft}</p><p className="text-xs text-slate-500">Draft</p></div>
        <div className="pl-4"><p className="text-2xl font-semibold text-slate-900">{values.inactive}</p><p className="text-xs text-slate-500">Inactive</p></div>
      </div>
    </div>
  )
}

export function OverviewPage() {
  const overviewQuery = useQuery({ queryKey: ['adminOverview'], queryFn: overviewApi.get })

  if (overviewQuery.isLoading) return <p className="text-sm text-slate-400">Loading overview…</p>
  if (overviewQuery.isError) return <p className="text-sm text-red-600">{overviewQuery.error.message}</p>

  const data = overviewQuery.data!
  const attention = [
    { label: 'Active draft questions', value: data.questions.draftActive, to: '/questions' },
    { label: 'Inactive published questions', value: data.questions.publishedInactive, to: '/questions' },
    { label: 'Active draft fixed quizzes', value: data.fixedQuizzes.draftActive, to: '/fixed-quizzes' },
    { label: 'Inactive published fixed quizzes', value: data.fixedQuizzes.publishedInactive, to: '/fixed-quizzes' },
  ]

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">Overview</h1>
        <p className="mt-1 text-sm text-slate-500">Content status and items that need attention.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        <SummaryCard label="Questions" value={data.questions.total} to="/questions" icon={FileQuestion} />
        <SummaryCard label="Fixed Quizzes" value={data.fixedQuizzes.total} to="/fixed-quizzes" icon={Workflow} />
        <SummaryCard label="Passages" value={data.passages.total} to="/passages" icon={BookOpenText} />
        <SummaryCard label="Open Reports" value={data.reports.open} to="/question-reports" icon={Flag} urgent />
        <SummaryCard label="Users" value={data.users.total} to="/users" icon={Users} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <ContentBreakdown title="Questions" values={data.questions} to="/questions" />
        <ContentBreakdown title="Fixed Quizzes" values={data.fixedQuizzes} to="/fixed-quizzes" />
      </div>

      <div className="mt-6 rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="font-semibold text-slate-900">Needs attention</h2>
        <p className="mt-1 text-sm text-slate-500">These status combinations can cause accidental visibility or hidden published content.</p>
        <div className="mt-4 divide-y divide-slate-100">
          {attention.map((item) => (
            <Link key={item.label} to={item.to} className="flex items-center justify-between py-3 text-sm hover:text-slate-900">
              <span className="text-slate-600">{item.label}</span>
              <span className={`font-semibold ${item.value > 0 ? 'text-amber-600' : 'text-slate-400'}`}>{item.value}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
