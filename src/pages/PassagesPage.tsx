import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import type { ColumnDef } from '../components/DataTable'
import { passagesApi, type PassageListItem } from '../lib/api/passages'
import { questionsApi, type Question } from '../lib/api/questions'
import { subjectsApi } from '../lib/api/subjects'
import { topicsApi } from '../lib/api/topics'
import { subtopicsApi } from '../lib/api/subtopics'
import { DataTable } from '../components/DataTable'
import { Modal } from '../components/Modal'
import { ArchivedSection } from '../components/ArchivedSection'
import { TableRowActions } from '../components/TableRowActions'
import { Button, SelectInput, TextInput } from '../components/fields'
import {
  PassageForm,
  initialPassageFormValues,
  isPassageContentValid,
  toPassageFields,
  type PassageFormValues,
} from '../components/passages/PassageForm'

interface PassageFilters {
  subjectId?: string
  topicId?: string
  search?: string
}

function passagePreview(p: PassageListItem): string {
  const raw = p.text.en?.value || p.text.hi?.value || ''
  const plain = raw.replace(/!\[[^\]]*\]\([^)]+\)/g, '[image]').replace(/[*$]/g, '')
  return plain.length > 100 ? `${plain.slice(0, 100)}…` : plain || '(no text)'
}

function questionPreview(q: Question): string {
  const raw = q.text.en?.value || q.text.hi?.value || ''
  const plain = raw.replace(/!\[[^\]]*\]\([^)]+\)/g, '[image]').replace(/[*$]/g, '')
  return plain.length > 80 ? `${plain.slice(0, 80)}…` : plain || '(no text)'
}

function matchesSearch(p: PassageListItem, term: string): boolean {
  const haystack = `${p.text.en?.value ?? ''} ${p.text.hi?.value ?? ''}`.toLowerCase()
  return haystack.includes(term.toLowerCase())
}

export function PassagesPage() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [filters, setFilters] = useState<PassageFilters>({})
  const [editing, setEditing] = useState<PassageListItem | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [formValues, setFormValues] = useState<PassageFormValues | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)

  const subjectsQuery = useQuery({ queryKey: ['subjects', false], queryFn: () => subjectsApi.list(false) })
  const topicsQuery = useQuery({ queryKey: ['topics', false], queryFn: () => topicsApi.list(false) })
  const subtopicsQuery = useQuery({ queryKey: ['subtopics', false], queryFn: () => subtopicsApi.list(false) })
  const passagesQuery = useQuery({ queryKey: ['passages'], queryFn: () => passagesApi.list() })

  // Only meaningful once a real (already-saved) passage is being edited — a brand-new passage
  // has no attached questions yet by definition.
  const attachedActiveQuery = useQuery({
    queryKey: ['questions', false, { passageId: editing?.id }, 0],
    queryFn: () => questionsApi.list(false, { passageId: editing!.id }, 0, 200),
    enabled: Boolean(editing),
  })
  const attachedArchivedQuery = useQuery({
    queryKey: ['questions', true, { passageId: editing?.id }, 0],
    queryFn: () => questionsApi.list(true, { passageId: editing!.id }, 0, 200),
    enabled: Boolean(editing),
  })

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['passages'] })
  }

  const saveMutation = useMutation({
    mutationFn: () => {
      if (!formValues) throw new Error('Nothing to save')
      const fields = toPassageFields(formValues)
      // Reuses the exact same passagesApi.update() call QuestionForm's "attach existing" flow
      // already uses to save edits back to a shared passage — propagating to every question
      // attached to it is a property of that one update path, not logic to reimplement here.
      return editing ? passagesApi.update(editing.id, fields) : passagesApi.create(fields)
    },
    onSuccess: () => {
      toast.success(editing ? 'Passage updated.' : 'Passage created.')
      setFormOpen(false)
      invalidate()
    },
    onError: (e) => setSaveError(e instanceof Error ? e.message : 'Something went wrong.'),
  })

  const subjects = subjectsQuery.data ?? []
  const topics = topicsQuery.data ?? []
  const subtopics = subtopicsQuery.data ?? []
  const passages = passagesQuery.data ?? []

  const filteredPassages = passages.filter((p) => {
    if (filters.subjectId && p.subject_id !== filters.subjectId) return false
    if (filters.topicId && p.topic_id !== filters.topicId) return false
    if (filters.search && !matchesSearch(p, filters.search)) return false
    return true
  })

  function topicName(topicId: string): string {
    return topics.find((t) => t.id === topicId)?.name ?? '—'
  }
  function subjectName(subjectId: string): string {
    return subjects.find((s) => s.id === subjectId)?.name ?? '—'
  }

  function openCreate() {
    setEditing(null)
    setSaveError(null)
    setFormValues(initialPassageFormValues(null, { subjectId: subjects[0]?.id ?? '' }))
    setFormOpen(true)
  }

  function openEdit(passage: PassageListItem) {
    setEditing(passage)
    setSaveError(null)
    setFormValues(initialPassageFormValues(passage, { subjectId: passage.subject_id }))
    setFormOpen(true)
  }

  function goToQuestion(id: string) {
    setFormOpen(false)
    navigate(`/questions?edit=${id}`)
  }

  const columns: ColumnDef<PassageListItem>[] = [
    { id: 'preview', header: 'Passage', className: 'w-full max-w-0', cell: ({ row }) => {
      const preview = passagePreview(row.original)
      return <span className="block truncate text-slate-900" title={preview}>{preview}</span>
    } },
    { id: 'subject', header: 'Subject', className: 'w-px', cell: ({ row }) => subjectName(row.original.subject_id) },
    { id: 'topic', header: 'Topic', className: 'w-px', cell: ({ row }) => topicName(row.original.topic_id) },
    { id: 'count', header: 'count', className: 'w-px', cell: ({ row }) => row.original.question_count },
    {
      id: 'actions',
      header: '',
      className: 'w-px',
      cell: ({ row }) => (
        <TableRowActions editLabel="Edit passage" onEdit={() => openEdit(row.original)} />
      ),
    },
  ]

  const formValid = formValues ? isPassageContentValid(formValues.textEn, formValues.textHi) : false
  const canSave = Boolean(formValues && formValues.subject_id && formValues.topic_id && formValid && !saveMutation.isPending)

  const attachedActive = attachedActiveQuery.data?.items ?? []
  const attachedArchived = attachedArchivedQuery.data?.items ?? []

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Passages</h1>
          <p className="text-sm text-slate-500">{filteredPassages.length} passage(s) match the current filters.</p>
        </div>
        <Button onClick={openCreate} disabled={subjects.length === 0}>
          Add Passage
        </Button>
      </div>

      <div className="mb-4 grid grid-cols-3 gap-2.5 rounded-lg border border-slate-200 bg-white p-3">
        <SelectInput
          value={filters.subjectId ?? ''}
          onChange={(e) => setFilters({ ...filters, subjectId: e.target.value || undefined, topicId: undefined })}
        >
          <option value="">All subjects</option>
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </SelectInput>
        <SelectInput value={filters.topicId ?? ''} onChange={(e) => setFilters({ ...filters, topicId: e.target.value || undefined })}>
          <option value="">All topics</option>
          {topics.filter((t) => !filters.subjectId || t.subject_id === filters.subjectId).map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </SelectInput>
        <TextInput
          placeholder="Search passage text…"
          value={filters.search ?? ''}
          onChange={(e) => setFilters({ ...filters, search: e.target.value || undefined })}
        />
      </div>

      <DataTable columns={columns} data={filteredPassages} emptyMessage="No passages match these filters." fitContainer />

      {formValues && (
        <Modal open={formOpen} onOpenChange={setFormOpen} title={editing ? 'Edit Passage' : 'Add Passage'} wide>
          {saveError && <div className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{saveError}</div>}
          {editing && attachedActive.length > 0 && (
            <p className="mb-4 text-xs text-amber-600">
              Editing this text updates the shared passage for all {attachedActive.length} attached question(s), not just one.
            </p>
          )}
          <PassageForm values={formValues} onChange={setFormValues} subjects={subjects} topics={topics} subtopics={subtopics} />

          {editing && (
            <div className="mt-6 border-t border-slate-100 pt-4">
              <h3 className="mb-2 text-sm font-semibold text-slate-900">Attached questions ({attachedActive.length})</h3>
              {attachedActive.length === 0 ? (
                <p className="text-sm text-slate-400">
                  No questions attached yet — attach this passage from a question's own edit form in Question Bank.
                </p>
              ) : (
                <ul className="flex flex-col gap-1.5">
                  {attachedActive.map((q) => (
                    <li key={q.id} className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2 text-sm">
                      <span className="text-slate-700">{questionPreview(q)}</span>
                      <Button variant="ghost" onClick={() => goToQuestion(q.id)}>
                        Edit →
                      </Button>
                    </li>
                  ))}
                </ul>
              )}

              <ArchivedSection count={attachedArchived.length}>
                <ul className="flex flex-col gap-1.5 opacity-60">
                  {attachedArchived.map((q) => (
                    <li key={q.id} className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2 text-sm">
                      <span className="text-slate-700">{questionPreview(q)}</span>
                      <Button variant="ghost" onClick={() => goToQuestion(q.id)}>
                        Edit →
                      </Button>
                    </li>
                  ))}
                </ul>
              </ArchivedSection>
            </div>
          )}

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
    </div>
  )
}
