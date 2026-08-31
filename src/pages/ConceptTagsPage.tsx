import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ColumnDef } from '../components/DataTable'
import { toast } from 'sonner'
import { conceptTagsApi, type ConceptTag } from '../lib/api/conceptTags'
import { topicsApi } from '../lib/api/topics'
import { subtopicsApi } from '../lib/api/subtopics'
import { subjectsApi } from '../lib/api/subjects'
import { makeOptimisticToggle } from '../lib/optimisticToggle'
import { DataTable } from '../components/DataTable'
import { Modal } from '../components/Modal'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { ArchivedSection } from '../components/ArchivedSection'
import { TableRowActions } from '../components/TableRowActions'
import { Button, Field, SelectInput, TextInput, Toggle } from '../components/fields'

interface ConceptTagFormState {
  name: string
  topic_id: string
  subtopic_id: string
}

interface ConceptTagFilters {
  subjectId?: string
  topicId?: string
  subtopicId?: string
  active?: boolean
  search?: string
}

const EMPTY_FORM: ConceptTagFormState = { name: '', topic_id: '', subtopic_id: '' }

export function ConceptTagsPage() {
  const queryClient = useQueryClient()
  const activeQuery = useQuery({ queryKey: ['conceptTags', false], queryFn: () => conceptTagsApi.list(false) })
  const archivedQuery = useQuery({ queryKey: ['conceptTags', true], queryFn: () => conceptTagsApi.list(true) })
  const topicsQuery = useQuery({ queryKey: ['topics', false], queryFn: () => topicsApi.list(false) })
  const subtopicsQuery = useQuery({ queryKey: ['subtopics', false], queryFn: () => subtopicsApi.list(false) })
  const subjectsQuery = useQuery({ queryKey: ['subjects', false], queryFn: () => subjectsApi.list(false) })

  const [editing, setEditing] = useState<ConceptTag | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState<ConceptTagFormState>(EMPTY_FORM)
  const [archiveTarget, setArchiveTarget] = useState<ConceptTag | null>(null)
  const [filters, setFilters] = useState<ConceptTagFilters>({})

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['conceptTags'] })
  }

  const saveMutation = useMutation({
    mutationFn: () => {
      const fields = { name: form.name, topic_id: form.topic_id, subtopic_id: form.subtopic_id || null }
      return editing ? conceptTagsApi.update(editing.id, fields) : conceptTagsApi.create(fields)
    },
    onSuccess: () => {
      toast.success(editing ? 'Concept tag updated.' : 'Concept tag created.')
      setFormOpen(false)
      invalidate()
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Something went wrong.'),
  })

  const activeToggle = makeOptimisticToggle<ConceptTag[]>(queryClient, ['conceptTags', false], (list, id, active) =>
    list.map((item) => (item.id === id ? { ...item, active } : item)),
  )
  const setActiveMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => conceptTagsApi.setActive(id, active),
    onMutate: activeToggle.onMutate,
    onError: (e, vars, context) => {
      activeToggle.onError(e, vars, context)
      toast.error(e instanceof Error ? e.message : 'Something went wrong.')
    },
    onSettled: invalidate,
  })

  const archiveMutation = useMutation({
    mutationFn: (id: string) => conceptTagsApi.archive(id),
    onSuccess: () => {
      toast.success('Concept tag archived.')
      setArchiveTarget(null)
      invalidate()
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Something went wrong.'),
  })

  const restoreMutation = useMutation({
    mutationFn: (id: string) => conceptTagsApi.restore(id),
    onSuccess: () => {
      toast.success('Concept tag restored — remember to re-enable Active if it should be visible again.')
      invalidate()
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Something went wrong.'),
  })

  const topics = topicsQuery.data ?? []
  const subjects = subjectsQuery.data ?? []
  const subtopics = subtopicsQuery.data ?? []
  const subtopicsForTopic = (subtopicsQuery.data ?? []).filter((s) => s.topic_id === form.topic_id)
  const topicsForSelectedSubject = topics.filter((topic) => !filters.subjectId || topic.subject_id === filters.subjectId)
  const topicIdsForSelectedSubject = new Set(topicsForSelectedSubject.map((topic) => topic.id))
  const subtopicsForSelection = subtopics.filter((subtopic) =>
    filters.topicId
      ? subtopic.topic_id === filters.topicId
      : !filters.subjectId || topicIdsForSelectedSubject.has(subtopic.topic_id),
  )
  const filteredConceptTags = (activeQuery.data ?? []).filter((tag) => {
    if (filters.subjectId && !topicIdsForSelectedSubject.has(tag.topic_id)) return false
    if (filters.topicId && tag.topic_id !== filters.topicId) return false
    if (filters.subtopicId && tag.subtopic_id !== filters.subtopicId && tag.subtopic_id !== null) return false
    if (filters.active !== undefined && tag.active !== filters.active) return false
    if (filters.search && !tag.name.toLowerCase().includes(filters.search.toLowerCase())) return false
    return true
  })

  function openCreate() {
    setEditing(null)
    setForm({ ...EMPTY_FORM, topic_id: topics[0]?.id ?? '' })
    setFormOpen(true)
  }

  function openEdit(tag: ConceptTag) {
    setEditing(tag)
    setForm({ name: tag.name, topic_id: tag.topic_id, subtopic_id: tag.subtopic_id ?? '' })
    setFormOpen(true)
  }

  const columns: ColumnDef<ConceptTag>[] = [
    { accessorKey: 'name', header: 'Name', className: 'w-px', cell: (c) => <span className="font-medium text-slate-900">{c.getValue<string>()}</span> },
    {
      accessorKey: 'topicName',
      header: 'Topic',
      className: 'w-full max-w-0',
      cell: (c) => {
        const topicName = c.getValue<string>()
        return <span className="block truncate" title={topicName}>{topicName}</span>
      },
    },
    { accessorKey: 'subtopicName', header: 'Subtopic', className: 'w-px', cell: (c) => c.getValue<string>() || <span className="text-slate-300">—</span> },
    { accessorKey: 'questionCount', header: 'Count', className: 'w-px' },
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
          editLabel="Edit concept tag"
          archiveLabel="Archive concept tag"
          onEdit={() => openEdit(row.original)}
          onArchive={() => setArchiveTarget(row.original)}
        />
      ),
    },
  ]

  const archivedColumns: ColumnDef<ConceptTag>[] = [
    { accessorKey: 'name', header: 'Name', className: 'w-px' },
    {
      accessorKey: 'topicName',
      header: 'Topic',
      className: 'w-full max-w-0',
      cell: (c) => {
        const topicName = c.getValue<string>()
        return <span className="block truncate" title={topicName}>{topicName}</span>
      },
    },
    { accessorKey: 'subtopicName', header: 'Subtopic', className: 'w-px', cell: (c) => c.getValue<string>() || <span className="text-slate-300">—</span> },
    { accessorKey: 'questionCount', header: 'Count', className: 'w-px' },
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

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Concept Tags</h1>
          <p className="text-sm text-slate-500">{filteredConceptTags.length} concept tag(s) match the current filters.</p>
        </div>
        <Button onClick={openCreate} disabled={topics.length === 0}>
          Add Concept Tag
        </Button>
      </div>

      {topics.length === 0 && <p className="mb-4 text-sm text-amber-600">Add a topic first — a concept tag needs one to belong to.</p>}

      <div className="mb-4 grid grid-cols-5 gap-2.5 rounded-lg border border-slate-200 bg-white p-3">
        <SelectInput
          value={filters.subjectId ?? ''}
          onChange={(e) =>
            setFilters({
              ...filters,
              subjectId: e.target.value || undefined,
              topicId: undefined,
              subtopicId: undefined,
            })
          }
        >
          <option value="">All subjects</option>
          {subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}
        </SelectInput>
        <SelectInput
          value={filters.topicId ?? ''}
          onChange={(e) => setFilters({ ...filters, topicId: e.target.value || undefined, subtopicId: undefined })}
        >
          <option value="">All topics</option>
          {topicsForSelectedSubject.map((topic) => <option key={topic.id} value={topic.id}>{topic.name}</option>)}
        </SelectInput>
        <SelectInput
          value={filters.subtopicId ?? ''}
          onChange={(e) => setFilters({ ...filters, subtopicId: e.target.value || undefined })}
        >
          <option value="">All subtopics</option>
          {subtopicsForSelection.map((subtopic) => <option key={subtopic.id} value={subtopic.id}>{subtopic.name}</option>)}
        </SelectInput>
        <SelectInput
          value={filters.active === undefined ? '' : String(filters.active)}
          onChange={(e) => setFilters({ ...filters, active: e.target.value === '' ? undefined : e.target.value === 'true' })}
        >
          <option value="">Active + inactive</option>
          <option value="true">Active only</option>
          <option value="false">Inactive only</option>
        </SelectInput>
        <TextInput
          placeholder="Search concept tags…"
          value={filters.search ?? ''}
          onChange={(e) => setFilters({ ...filters, search: e.target.value || undefined })}
        />
      </div>

      <DataTable columns={columns} data={filteredConceptTags} emptyMessage="No concept tags match these filters." fitContainer />

      <ArchivedSection count={archivedQuery.data?.length ?? 0}>
        <DataTable columns={archivedColumns} data={archivedQuery.data ?? []} dimmed emptyMessage="No archived concept tags." fitContainer />
      </ArchivedSection>

      <Modal open={formOpen} onOpenChange={setFormOpen} title={editing ? 'Edit Concept Tag' : 'Add Concept Tag'}>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            saveMutation.mutate()
          }}
          className="flex flex-col gap-4"
        >
          <Field label="Name">
            <TextInput required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="Topic">
            <SelectInput
              required
              value={form.topic_id}
              onChange={(e) => setForm({ ...form, topic_id: e.target.value, subtopic_id: '' })}
            >
              {topics.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </SelectInput>
          </Field>
          <Field label="Subtopic" hint="Optional — narrows this tag to one subtopic within the topic above.">
            <SelectInput value={form.subtopic_id} onChange={(e) => setForm({ ...form, subtopic_id: e.target.value })}>
              <option value="">None</option>
              {subtopicsForTopic.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </SelectInput>
          </Field>
          <div className="mt-2 flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setFormOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={archiveTarget !== null}
        onOpenChange={(open) => !open && setArchiveTarget(null)}
        title="Archive this concept tag?"
        message={`"${archiveTarget?.name}" will be hidden from active lists and every dropdown across the admin. It stays in the database and can be restored later.`}
        confirmLabel="Archive"
        busy={archiveMutation.isPending}
        onConfirm={() => archiveTarget && archiveMutation.mutate(archiveTarget.id)}
      />
    </div>
  )
}
