import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Archive, Pencil } from 'lucide-react'
import type { ColumnDef } from '../components/DataTable'
import { toast } from 'sonner'
import { questionsApi, type Question, type QuestionFilters } from '../lib/api/questions'
import { makeOptimisticToggle } from '../lib/optimisticToggle'
import { examsApi } from '../lib/api/exams'
import { subjectsApi } from '../lib/api/subjects'
import { topicsApi } from '../lib/api/topics'
import { subtopicsApi } from '../lib/api/subtopics'
import { conceptTagsApi } from '../lib/api/conceptTags'
import { passagesApi } from '../lib/api/passages'
import { DataTable } from '../components/DataTable'
import { Modal } from '../components/Modal'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { ArchivedSection } from '../components/ArchivedSection'
import { Button, SelectInput, TextInput, Toggle } from '../components/fields'
import {
  QuestionForm,
  initialFormValues,
  toPassageFields,
  toQuestionFields,
  type QuestionFormValues,
} from '../components/questions/QuestionForm'
import { checkBilingualComplete, isPassageValid } from '../lib/richtext/bilingualValidation'

const PAGE_SIZE = 20

function questionPreview(q: Question): string {
  const raw = q.text.en?.value || q.text.hi?.value || ''
  const plain = raw.replace(/!\[[^\]]*\]\([^)]+\)/g, '[image]').replace(/[*$]/g, '')
  return plain.length > 80 ? `${plain.slice(0, 80)}…` : plain || '(no text)'
}

export function QuestionsPage() {
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const [filters, setFilters] = useState<QuestionFilters>({})
  const [page, setPage] = useState(0)
  const [editing, setEditing] = useState<Question | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [formValues, setFormValues] = useState<QuestionFormValues | null>(null)
  const [archiveTarget, setArchiveTarget] = useState<Question | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)

  const examsQuery = useQuery({ queryKey: ['exams', false], queryFn: () => examsApi.list(false) })
  const subjectsQuery = useQuery({ queryKey: ['subjects', false], queryFn: () => subjectsApi.list(false) })
  const topicsQuery = useQuery({ queryKey: ['topics', false], queryFn: () => topicsApi.list(false) })
  const subtopicsQuery = useQuery({ queryKey: ['subtopics', false], queryFn: () => subtopicsApi.list(false) })
  const conceptTagsQuery = useQuery({ queryKey: ['conceptTags', false], queryFn: () => conceptTagsApi.list(false) })
  const passagesQuery = useQuery({ queryKey: ['passages'], queryFn: () => passagesApi.list() })

  const listQuery = useQuery({
    queryKey: ['questions', false, filters, page],
    queryFn: () => questionsApi.list(false, filters, page, PAGE_SIZE),
  })
  const archivedQuery = useQuery({
    queryKey: ['questions', true, {}, 0],
    queryFn: () => questionsApi.list(true, {}, 0, 200),
  })

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['questions'] })
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!formValues) throw new Error('Nothing to save')

      // Passage save happens first, since the question row needs a real passage_id — 'new'
      // creates a fresh passages row; 'existing' saves any edits back to the SAME shared row
      // (propagating to every other question already attached to it, the whole point of
      // treating passages as their own entity rather than per-question text).
      let resolvedPassageId: string | null = null
      if (formValues.passageMode === 'new') {
        const created = await passagesApi.create(toPassageFields(formValues))
        resolvedPassageId = created.id
      } else if (formValues.passageMode === 'existing') {
        if (!formValues.passageId) throw new Error('Select an existing passage or switch to "Create new".')
        await passagesApi.update(formValues.passageId, toPassageFields(formValues))
        resolvedPassageId = formValues.passageId
      }

      const fields = toQuestionFields(formValues, resolvedPassageId)
      const examIds = formValues.type === 'Practice' ? formValues.practiceExamIds : undefined
      return editing ? questionsApi.update(editing.id, fields, examIds) : questionsApi.create(fields, examIds)
    },
    onSuccess: () => {
      toast.success(editing ? 'Question updated.' : 'Question created.')
      setFormOpen(false)
      invalidate()
      queryClient.invalidateQueries({ queryKey: ['passages'] })
    },
    onError: (e) => setSaveError(e instanceof Error ? e.message : 'Something went wrong.'),
  })

  const activeToggle = makeOptimisticToggle<{ items: Question[]; total: number }>(
    queryClient,
    ['questions', false, filters, page],
    (data, id, active) => ({ ...data, items: data.items.map((item) => (item.id === id ? { ...item, active } : item)) }),
  )
  const setActiveMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => questionsApi.setActive(id, active),
    onMutate: activeToggle.onMutate,
    onError: (e, vars, context) => {
      activeToggle.onError(e, vars, context)
      toast.error(e instanceof Error ? e.message : 'Something went wrong.')
    },
    onSettled: invalidate,
  })

  const archiveMutation = useMutation({
    mutationFn: (id: string) => questionsApi.archive(id),
    onSuccess: () => {
      toast.success('Question archived.')
      setArchiveTarget(null)
      invalidate()
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Something went wrong.'),
  })

  const restoreMutation = useMutation({
    mutationFn: (id: string) => questionsApi.restore(id),
    onSuccess: () => {
      toast.success('Question restored — remember to re-enable Active if it should be visible again.')
      invalidate()
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Something went wrong.'),
  })

  const subjects = subjectsQuery.data ?? []
  const topics = topicsQuery.data ?? []
  const subtopics = subtopicsQuery.data ?? []
  const conceptTags = conceptTagsQuery.data ?? []
  const exams = examsQuery.data ?? []
  const passages = passagesQuery.data ?? []
  const topicsForSelectedSubject = topics.filter((topic) => !filters.subjectId || topic.subject_id === filters.subjectId)
  const topicIdsForSelectedSubject = new Set(topicsForSelectedSubject.map((topic) => topic.id))
  const subtopicsForSelection = subtopics.filter((subtopic) =>
    filters.topicId
      ? subtopic.topic_id === filters.topicId
      : !filters.subjectId || topicIdsForSelectedSubject.has(subtopic.topic_id),
  )
  const conceptTagsForSelection = conceptTags.filter((conceptTag) => {
    if (filters.topicId && conceptTag.topic_id !== filters.topicId) return false
    if (!filters.topicId && filters.subjectId && !topicIdsForSelectedSubject.has(conceptTag.topic_id)) return false
    if (filters.subtopicId && conceptTag.subtopic_id !== filters.subtopicId && conceptTag.subtopic_id !== null) return false
    return true
  })

  async function openCreate() {
    setEditing(null)
    setSaveError(null)
    setFormValues(initialFormValues(null, { subjectId: subjects[0]?.id ?? '' }, passages))
    setFormOpen(true)
  }

  async function openEdit(question: Question) {
    setEditing(question)
    setSaveError(null)
    const values = initialFormValues(question, { subjectId: question.subject_id }, passages)
    if (question.type === 'Practice') {
      try {
        values.practiceExamIds = await questionsApi.getExamIds(question.id)
      } catch {
        // Non-fatal — the exam-tagging multi-select just starts empty if this lookup fails
        // (guardrail: an auxiliary lookup must never block opening the form to edit).
      }
    }
    setFormValues(values)
    setFormOpen(true)
  }

  // Deep link from the Passages page's "Edit →" link on an attached question (?edit=<id>) —
  // fetched by id directly (not via list/filters/pagination) since the linked question may not
  // be on whatever page/filter this table currently happens to be showing. Deliberately keyed
  // on searchParams alone: openEdit is recreated every render (including it in deps would
  // re-fire this on every keystroke in the very form it opens), and setSearchParams is a stable
  // setter (react-router guarantee), same as a plain dispatch.
  useEffect(() => {
    const editId = searchParams.get('edit')
    if (!editId) return
    let active = true
    questionsApi
      .getById(editId)
      .then((question) => {
        if (active) openEdit(question)
      })
      .catch(() => {
        if (active) toast.error("Couldn't load that question.")
      })
      .finally(() => {
        const next = new URLSearchParams(searchParams)
        next.delete('edit')
        setSearchParams(next, { replace: true })
      })
    return () => {
      active = false
    }
  }, [searchParams])

  const columns: ColumnDef<Question>[] = [
    {
      id: 'preview',
      header: 'Question',
      className: 'w-full max-w-0',
      cell: ({ row }) => {
        const preview = questionPreview(row.original)
        return (
          <span className="block truncate text-slate-900" title={preview}>
            {preview}
          </span>
        )
      },
    },
    { accessorKey: 'type', header: 'Type', className: 'w-px' },
    { accessorKey: 'difficulty', header: 'Difficulty', className: 'w-px' },
    {
      id: 'marking',
      header: 'Marking',
      className: 'w-px',
      cell: ({ row }) => (
        <span>
          <span className="text-emerald-700">+{row.original.positive_marks}</span>
          <span className="text-slate-400"> / </span>
          <span className="text-red-700">{row.original.negative_marks > 0 ? `-${row.original.negative_marks}` : '0'}</span>
        </span>
      ),
    },
    { accessorKey: 'status', header: 'Status', className: 'w-px' },
    {
      id: 'passage',
      header: 'Passage',
      className: 'w-px',
      cell: ({ row }) => (row.original.passage_id ? '✓' : ''),
    },
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
        <div className="flex gap-1">
          <Button
            variant="ghost"
            className="!p-1.5"
            aria-label="Edit question"
            title="Edit"
            onClick={() => openEdit(row.original)}
          >
            <Pencil aria-hidden="true" size={16} />
          </Button>
          <Button
            variant="ghost"
            className="!p-1.5"
            aria-label="Archive question"
            title="Archive"
            onClick={() => setArchiveTarget(row.original)}
          >
            <Archive aria-hidden="true" size={16} />
          </Button>
        </div>
      ),
    },
  ]

  const archivedColumns: ColumnDef<Question>[] = [
    {
      id: 'preview',
      header: 'Question',
      className: 'w-full max-w-0',
      cell: ({ row }) => {
        const preview = questionPreview(row.original)
        return (
          <span className="block truncate" title={preview}>
            {preview}
          </span>
        )
      },
    },
    { accessorKey: 'type', header: 'Type', className: 'w-px' },
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

  const total = listQuery.data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const bilingual = formValues ? checkBilingualComplete(formValues.textEn, formValues.textHi, formValues.options) : null
  const passageOk = formValues ? isPassageValid(formValues.passageEn, formValues.passageHi) : true
  const canSave = Boolean(
    formValues && formValues.subject_id && formValues.topic_id && bilingual?.valid && passageOk && !saveMutation.isPending,
  )

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Question Bank</h1>
          <p className="text-sm text-slate-500">{total} question(s) match the current filters.</p>
        </div>
        <Button onClick={openCreate} disabled={subjects.length === 0}>
          Add Question
        </Button>
      </div>

      <div className="mb-4 grid grid-cols-5 gap-2.5 rounded-lg border border-slate-200 bg-white p-3">
        <SelectInput
          value={filters.subjectId ?? ''}
          onChange={(e) => {
            setFilters({
              ...filters,
              subjectId: e.target.value || undefined,
              topicId: undefined,
              subtopicId: undefined,
              conceptTagId: undefined,
            })
            setPage(0)
          }}
        >
          <option value="">All subjects</option>
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </SelectInput>
        <SelectInput
          value={filters.topicId ?? ''}
          onChange={(e) => {
            setFilters({
              ...filters,
              topicId: e.target.value || undefined,
              subtopicId: undefined,
              conceptTagId: undefined,
            })
            setPage(0)
          }}
        >
          <option value="">All topics</option>
          {topicsForSelectedSubject.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </SelectInput>
        <SelectInput
          value={filters.subtopicId ?? ''}
          onChange={(e) => {
            setFilters({ ...filters, subtopicId: e.target.value || undefined, conceptTagId: undefined })
            setPage(0)
          }}
        >
          <option value="">All subtopics</option>
          {subtopicsForSelection.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </SelectInput>
        <SelectInput
          value={filters.conceptTagId ?? ''}
          onChange={(e) => {
            setFilters({ ...filters, conceptTagId: e.target.value || undefined })
            setPage(0)
          }}
        >
          <option value="">All concept tags</option>
          {conceptTagsForSelection.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </SelectInput>
        <SelectInput
          value={filters.examId ?? ''}
          onChange={(e) => {
            setFilters({ ...filters, examId: e.target.value || undefined })
            setPage(0)
          }}
        >
          <option value="">All exams</option>
          {exams.map((ex) => (
            <option key={ex.id} value={ex.id}>
              {ex.name}
            </option>
          ))}
        </SelectInput>
        <SelectInput
          value={filters.type ?? ''}
          onChange={(e) => {
            setFilters({ ...filters, type: (e.target.value || undefined) as QuestionFilters['type'] })
            setPage(0)
          }}
        >
          <option value="">All types</option>
          <option value="PYQ">PYQ</option>
          <option value="Practice">Practice</option>
        </SelectInput>
        <SelectInput
          value={filters.difficulty ?? ''}
          onChange={(e) => {
            setFilters({ ...filters, difficulty: (e.target.value || undefined) as QuestionFilters['difficulty'] })
            setPage(0)
          }}
        >
          <option value="">All difficulties</option>
          <option value="easy">Easy</option>
          <option value="medium">Medium</option>
          <option value="hard">Hard</option>
        </SelectInput>
        <SelectInput
          value={filters.status ?? ''}
          onChange={(e) => {
            setFilters({ ...filters, status: (e.target.value || undefined) as QuestionFilters['status'] })
            setPage(0)
          }}
        >
          <option value="">All statuses</option>
          <option value="Draft">Draft</option>
          <option value="Published">Published</option>
        </SelectInput>
        <SelectInput
          value={filters.active === undefined ? '' : String(filters.active)}
          onChange={(e) => {
            setFilters({ ...filters, active: e.target.value === '' ? undefined : e.target.value === 'true' })
            setPage(0)
          }}
        >
          <option value="">Active + inactive</option>
          <option value="true">Active only</option>
          <option value="false">Inactive only</option>
        </SelectInput>
        <TextInput
          placeholder="Search question text…"
          value={filters.search ?? ''}
          onChange={(e) => {
            setFilters({ ...filters, search: e.target.value || undefined })
            setPage(0)
          }}
        />
      </div>

      <DataTable
        columns={columns}
        data={listQuery.data?.items ?? []}
        emptyMessage="No questions match these filters."
        fitContainer
      />

      {!filters.examId && (
        <div className="mt-3 flex items-center justify-between text-sm text-slate-500">
          <span>
            Page {page + 1} of {totalPages}
          </span>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}>
              Previous
            </Button>
            <Button variant="secondary" onClick={() => setPage((p) => p + 1)} disabled={page + 1 >= totalPages}>
              Next
            </Button>
          </div>
        </div>
      )}

      <ArchivedSection count={archivedQuery.data?.total ?? 0}>
        <DataTable
          columns={archivedColumns}
          data={archivedQuery.data?.items ?? []}
          dimmed
          emptyMessage="No archived questions."
          fitContainer
        />
      </ArchivedSection>

      {formValues && (
        <Modal open={formOpen} onOpenChange={setFormOpen} title={editing ? 'Edit Question' : 'Add Question'} wide>
          {saveError && <div className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{saveError}</div>}
          <QuestionForm
            values={formValues}
            onChange={setFormValues}
            subjects={subjects}
            topics={topics}
            subtopics={subtopics}
            conceptTags={conceptTags}
            exams={exams}
            passages={passages}
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
        title="Archive this question?"
        message="It will be hidden from active lists, dropdowns, and every quiz pool. It stays in the database (already-built Fixed Quizzes referencing it are unaffected) and can be restored later."
        confirmLabel="Archive"
        busy={archiveMutation.isPending}
        onConfirm={() => archiveTarget && archiveMutation.mutate(archiveTarget.id)}
      />
    </div>
  )
}
