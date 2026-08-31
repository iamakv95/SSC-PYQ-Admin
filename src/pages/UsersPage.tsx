import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { DataTable, type ColumnDef } from '../components/DataTable'
import { usersApi, type AdminUser, type UserCategory } from '../lib/api/users'

const PAGE_SIZE = 50

function formatDate(value: string | null): string {
  if (!value) return '—'
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

export function UsersPage() {
  const [category, setCategory] = useState<UserCategory>('all')
  const [page, setPage] = useState(0)
  const usersQuery = useQuery({
    queryKey: ['adminUsers', category, page],
    queryFn: () => usersApi.list(category, page, PAGE_SIZE),
  })

  const columns: ColumnDef<AdminUser>[] = [
    {
      id: 'user',
      header: 'User',
      className: 'w-full max-w-0',
      cell: ({ row }) => (
        <div className="min-w-0">
          <span className="block truncate font-medium text-slate-900" title={row.original.displayName}>
            {row.original.displayName}
          </span>
          <span className="block truncate text-xs text-slate-400" title={row.original.email ?? row.original.id}>
            {row.original.email ?? row.original.id}
          </span>
        </div>
      ),
    },
    {
      id: 'account',
      header: 'Account',
      className: 'w-px',
      cell: ({ row }) => (
        <span className={`rounded-full px-2 py-1 text-xs font-medium ${row.original.isGuest ? 'bg-slate-100 text-slate-600' : 'bg-blue-50 text-blue-700'}`}>
          {row.original.isGuest ? 'Guest' : 'Real'}
        </span>
      ),
    },
    {
      id: 'exam',
      header: 'Target Exam',
      className: 'w-px',
      cell: ({ row }) => row.original.examName ?? '—',
    },
    {
      accessorKey: 'xpTotal',
      header: 'XP',
      className: 'w-px text-right',
    },
    {
      accessorKey: 'currentStreak',
      header: 'Streak',
      className: 'w-px text-right',
    },
    {
      id: 'plan',
      header: 'Plan',
      className: 'w-px',
      cell: ({ row }) => (
        <span className={`rounded-full px-2 py-1 text-xs font-medium ${row.original.isPro ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>
          {row.original.isPro ? 'Pro' : 'Free'}
        </span>
      ),
    },
    {
      id: 'joined',
      header: 'Joined',
      className: 'w-px',
      cell: ({ row }) => formatDate(row.original.createdAt),
    },
    {
      id: 'lastSignIn',
      header: 'Last Sign-in',
      className: 'w-px',
      cell: ({ row }) => formatDate(row.original.lastSignInAt),
    },
  ]

  const total = usersQuery.data?.total ?? 0
  const hasNextPage = (page + 1) * PAGE_SIZE < total

  return (
    <div>
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Users</h1>
          <p className="mt-1 text-sm text-slate-500">View real and guest accounts using the mobile app.</p>
        </div>
        <div className="flex rounded-md border border-slate-200 bg-white p-1">
          {([
            ['all', 'All'],
            ['real', 'Real users'],
            ['guest', 'Guest users'],
          ] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => {
                setCategory(value)
                setPage(0)
              }}
              className={`rounded px-3 py-1.5 text-sm font-medium ${
                category === value ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-100'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {usersQuery.isLoading ? (
        <p className="text-sm text-slate-400">Loading users…</p>
      ) : usersQuery.isError ? (
        <p className="text-sm text-red-600">{usersQuery.error.message}</p>
      ) : (
        <>
          <p className="mb-2 text-sm text-slate-500">
            {total} {category === 'all' ? 'users' : category === 'real' ? 'real users' : 'guest users'}
          </p>
          <DataTable columns={columns} data={usersQuery.data?.items ?? []} emptyMessage="No users found." fitContainer />
          {total > PAGE_SIZE && (
            <div className="mt-4 flex items-center justify-between">
              <button
                type="button"
                disabled={page === 0}
                onClick={() => setPage((current) => Math.max(0, current - 1))}
                className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Previous
              </button>
              <span className="text-sm text-slate-500">Page {page + 1}</span>
              <button
                type="button"
                disabled={!hasNextPage}
                onClick={() => setPage((current) => current + 1)}
                className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
