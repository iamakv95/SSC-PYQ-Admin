import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ColumnDef } from '../components/DataTable'
import { toast } from 'sonner'
import { fixedQuizzesApi, type FixedQuiz } from '../lib/api/fixedQuizzes'
import { makeOptimisticToggle } from '../lib/optimisticToggle'
import { examsApi } from '../lib/api/exams'
import { subjectsApi } from '../lib/api/subjects'
import { topicsApi } from '../lib/api/topics'
import { DataTable } from '../components/DataTable'
import { Modal } from '../components/Modal'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { ArchivedSection } from '../components/ArchivedSection'
import { TableRowActions } from '../components/TableRowActions'
import { Button, SelectInput, TextInput, Toggle } from '../components/fields'
import {
  FixedQuizForm,
  initialFixedQuizValues,
  toFixedQuizFields,
  type FixedQuizFormValues,
} from '../components/fixedQuizzes/FixedQuizForm'

interface FixedQuizFilters {
  examId?: string
  subjectId?: string
  topicId?: string
  type?: FixedQuiz['quiz_type']
  scope?: FixedQuiz['scope']
  status?: FixedQuiz['status']
  active?: boolean
  locked?: boolean
  search?: string
}

export function FixedQuizzesPage() {
  const queryClient = useQueryClient()
  const activeQuery = useQuery({ queryKey: ['fixedQuizzes', false], queryFn: () => fixedQuizzesApi.list(false) })
  const archivedQuery = useQuery({ queryKey: ['fixedQuizzes', true], queryFn: () => fixedQuizzesApi.list(true) })
  const examsQuery = useQuery({ queryKey: ['exams', false], queryFn: () => examsApi.list(false) })
  const subjectsQuery = useQuery({ queryKey: ['subjects', false], queryFn: () => subjectsApi.list(false) })
  const topicsQuery = useQuery({ queryKey: ['topics', false], queryFn: () => topicsApi.list(false) })

  const [editing, setEditing] = useState<FixedQuiz | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [formValues, setFormValues] = useState<FixedQuizFormValues | null>(null)
  const [questionIds, setQuestionIds] = useState<string[]>([])
  const [archiveTarget, setArchiveTarget] = useState<FixedQuiz | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [filters, setFilters] = useState<FixedQuizFilters>({})

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['fixedQuizzes'] })
  }

  const saveMutation = useMutation({
    mutationFn: () => {
      if (!formValues) throw new Error('Nothing to save')
      const fields = toFixedQuizFields(formValues)
      return editing ? fixedQuizzesApi.update(editing.id, fields, questionIds) : fixedQuizzesApi.create(fields, questionIds)
    },
    onSuccess: () => {
      toast.success(editing ? 'Fixed quiz updated.' : 'Fixed quiz created.')
      setFormOpen(false)
      invalidate()
    },
    onError: (e) => setSaveError(e instanceof Error ? e.message : 'Something went wrong.'),
  })

  const activeToggle = makeOptimisticToggle<FixedQuiz[]>(queryClient, ['fixedQuizzes', false], (list, id, active) =>
    list.map((item) => (item.id === id ? { ...item, active } : item)),
  )
  const setActiveMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => fixedQuizzesApi.setActive(id, active),
    onMutate: activeToggle.onMutate,
    onError: (e, vars, context) => {
      activeToggle.onError(e, vars, context)
      toast.error(e instanceof Error ? e.message : 'Something went wrong.')
    },
    onSettled: invalidate,
  })

  const archiveMutation = useMutation({
    mutationFn: (id: string) => fixedQuizzesApi.archive(id),
    onSuccess: () => {
      toast.success('Fixed quiz archived.')
      setArchiveTarget(null)
      invalidate()
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Something went wrong.'),
  })

  const restoreMutation = useMutation({
    mutationFn: (id: string) => fixedQuizzesApi.restore(id),
    onSuccess: () => {
      toast.success('Fixed quiz restored — remember to re-enable Active if it should be visible again.')
      invalidate()
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Something went wrong.'),
  })

  const exams = examsQuery.data ?? []
  const subjects = subjectsQuery.data ?? []
  const topics = topicsQuery.data ?? []
  const topicsForSelectedSubject = topics.filter((topic) => !filters.subjectId || topic.subject_id === filters.subjectId)
  const topicIdsForSelectedSubject = new Set(topicsForSelectedSubject.map((topic) => topic.id))
  const filteredQuizzes = (activeQuery.data ?? []).filter((quiz) => {
    if (filters.examId && quiz.exam_id !== filters.examId) return false
    if (
      filters.subjectId &&
      !(
        (quiz.scope === 'subject' && quiz.subject_id === filters.subjectId) ||
        (quiz.scope === 'topic' && quiz.topic_id !== null && topicIdsForSelectedSubject.has(quiz.topic_id))
      )
    ) return false
    if (filters.topicId && quiz.topic_id !== filters.topicId) return false
    if (filters.type && quiz.quiz_type !== filters.type) return false
    if (filters.scope && quiz.scope !== filters.scope) return false
    if (filters.status && quiz.status !== filters.status) return false
    if (filters.active !== undefined && quiz.active !== filters.active) return false
    if (filters.locked !== undefined && quiz.locked !== filters.locked) return false
    if (filters.search && !quiz.title.toLowerCase().includes(filters.search.toLowerCase())) return false
    return true
  })

  function openCreate() {
    setEditing(null)
    setSaveError(null)
    setFormValues(initialFixedQuizValues(null))
    setQuestionIds([])
    setFormOpen(true)
  }

  async function openEdit(quiz: FixedQuiz) {
    setEditing(quiz)
    setSaveError(null)
    setFormValues(initialFixedQuizValues(quiz))
    try {
      setQuestionIds(await fixedQuizzesApi.getQuestionIds(quiz.id))
    } catch {
      setQuestionIds([])
    }
    setFormOpen(true)
  }

  const columns: ColumnDef<FixedQuiz>[] = [
    { accessorKey: 'title', header: 'Title', className: 'w-full max-w-0', cell: (c) => <span className="block truncate font-medium text-slate-900">{c.getValue<string>()}</span> },
    { accessorKey: 'quiz_type', header: 'Type', className: 'w-px' },
    {
      id: 'scope',
      header: 'Scope',
      className: 'w-px',
      cell: ({ row }) => (row.original.scope === 'topic' ? row.original.topicName : row.original.subjectName),
    },
    { accessorKey: 'examName', header: 'Exam', className: 'w-px', cell: (c) => c.getValue<string>() || <span className="text-slate-300">Universal</span> },
    { accessorKey: 'questionCount', header: 'Count', className: 'w-px' },
    {
      id: 'timeLimit',
      header: 'Time',
      className: 'w-px',
      cell: ({ row }) =>
        row.original.time_limit_minutes !== null ? `${row.original.time_limit_minutes} min` : 'No limit',
    },
    {
      id: 'locked',
      header: 'Access',
      className: 'w-px',
      cell: ({ row }) => (
        <span className={row.original.locked ? 'text-amber-600' : 'text-emerald-600'}>{row.original.locked ? 'Locked (Pro)' : 'Unlocked'}</span>
      ),
    },
    { accessorKey: 'status', header: 'Status', className: 'w-px' },
    {
      id: 'active',
      header: 'Active',
      className: 'w-px',
      cell: ({ row }) => (
        <Toggle checked={row.original.active} onChange={(active) => setActiveMutation.mutate({ id: row.original.id, active })} label="" />
      ),
    },
    {
      id: 'actions',
      header: '',
      className: 'w-px',
      cell: ({ row }) => (
        <TableRowActions
          editLabel="Edit fixed quiz"
          archiveLabel="Archive fixed quiz"
          onEdit={() => openEdit(row.original)}
          onArchive={() => setArchiveTarget(row.original)}
        />
      ),
    },
  ]

  const archivedColumns: ColumnDef<FixedQuiz>[] = [
    { accessorKey: 'title', header: 'Title', className: 'w-full max-w-0' },
    { accessorKey: 'quiz_type', header: 'Type', className: 'w-px' },
    { accessorKey: 'status', header: 'Status', className: 'w-px' },
    {
      id: 'timeLimit',
      header: 'Time',
      className: 'w-px',
      cell: ({ row }) =>
        row.original.time_limit_minutes !== null ? `${row.original.time_limit_minutes} min` : 'No limit',
    },
    {
      id: 'restore',
      header: '',
      className: 'w-px',
      cell: ({ row }) => (
        <Button variant="secondary" onClick={() => restoreMutation.mutate(row.original.id)}>
          Restore
        </Button>
      ),
    },
  ]

  const canSave = Boolean(
    formValues &&
      formValues.title &&
      (formValues.scope === 'topic' ? formValues.topic_id : formValues.subject_id) &&
      questionIds.length > 0 &&
      !saveMutation.isPending,
  )

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Fixed Quizzes</h1>
          <p className="text-sm text-slate-500">{filteredQuizzes.length} fixed quiz(es) match the current filters.</p>
        </div>
        <Button onClick={openCreate}>Add Fixed Quiz</Button>
      </div>

      <div className="mb-4 grid grid-cols-5 gap-2.5 rounded-lg border border-slate-200 bg-white p-3">
        <SelectInput value={filters.examId ?? ''} onChange={(e) => setFilters({ ...filters, examId: e.target.value || undefined })}>
          <option value="">All exams</option>
          {exams.map((exam) => <option key={exam.id} value={exam.id}>{exam.name}</option>)}
        </SelectInput>
        <SelectInput
          value={filters.subjectId ?? ''}
          onChange={(e) => setFilters({ ...filters, subjectId: e.target.value || undefined, topicId: undefined })}
        >
          <option value="">All subjects</option>
          {subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}
        </SelectInput>
        <SelectInput value={filters.topicId ?? ''} onChange={(e) => setFilters({ ...filters, topicId: e.target.value || undefined })}>
          <option value="">All topics</option>
          {topicsForSelectedSubject.map((topic) => <option key={topic.id} value={topic.id}>{topic.name}</option>)}
        </SelectInput>
        <SelectInput
          value={filters.type ?? ''}
          onChange={(e) => setFilters({ ...filters, type: (e.target.value || undefined) as FixedQuizFilters['type'] })}
        >
          <option value="">All types</option>
          <option value="PYQ">PYQ</option>
          <option value="Practice">Practice</option>
        </SelectInput>
        <SelectInput
          value={filters.scope ?? ''}
          onChange={(e) => setFilters({ ...filters, scope: (e.target.value || undefined) as FixedQuizFilters['scope'] })}
        >
          <option value="">All scopes</option>
          <option value="subject">Subject</option>
          <option value="topic">Topic</option>
        </SelectInput>
        <SelectInput
          value={filters.status ?? ''}
          onChange={(e) => setFilters({ ...filters, status: (e.target.value || undefined) as FixedQuizFilters['status'] })}
        >
          <option value="">All statuses</option>
          <option value="Draft">Draft</option>
          <option value="Published">Published</option>
        </SelectInput>
        <SelectInput
          value={filters.active === undefined ? '' : String(filters.active)}
          onChange={(e) => setFilters({ ...filters, active: e.target.value === '' ? undefined : e.target.value === 'true' })}
        >
          <option value="">Active + inactive</option>
          <option value="true">Active only</option>
          <option value="false">Inactive only</option>
        </SelectInput>
        <SelectInput
          value={filters.locked === undefined ? '' : String(filters.locked)}
          onChange={(e) => setFilters({ ...filters, locked: e.target.value === '' ? undefined : e.target.value === 'true' })}
        >
          <option value="">Locked + unlocked</option>
          <option value="true">Locked only</option>
          <option value="false">Unlocked only</option>
        </SelectInput>
        <TextInput
          className="col-span-2"
          placeholder="Search quiz title…"
          value={filters.search ?? ''}
          onChange={(e) => setFilters({ ...filters, search: e.target.value || undefined })}
        />
      </div>

      <DataTable columns={columns} data={filteredQuizzes} emptyMessage="No fixed quizzes match these filters." fitContainer />

      <ArchivedSection count={archivedQuery.data?.length ?? 0}>
        <DataTable columns={archivedColumns} data={archivedQuery.data ?? []} dimmed emptyMessage="No archived fixed quizzes." fitContainer />
      </ArchivedSection>

      {formValues && (
        <Modal open={formOpen} onOpenChange={setFormOpen} title={editing ? 'Edit Fixed Quiz' : 'Add Fixed Quiz'} wide>
          {saveError && <div className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{saveError}</div>}
          <FixedQuizForm
            values={formValues}
            onChange={setFormValues}
            subjects={subjects}
            topics={topics}
            exams={exams}
            questionIds={questionIds}
            onQuestionIdsChange={setQuestionIds}
          />
          <div className="mt-6 flex justify-end gap-2 border-t border-slate-100 pt-4">
            <Button variant="secondary" onClick={() => setFormOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => saveMutation.mutate()} disabled={!canSave}>
              {saveMutation.isPending ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </Modal>
      )}

      <ConfirmDialog
        open={archiveTarget !== null}
        onOpenChange={(open) => !open && setArchiveTarget(null)}
        title="Archive this fixed quiz?"
        message="It will be hidden from active lists and the app. It stays in the database and can be restored later."
        confirmLabel="Archive"
        busy={archiveMutation.isPending}
        onConfirm={() => archiveTarget && archiveMutation.mutate(archiveTarget.id)}
      />
    </div>
  )
}
