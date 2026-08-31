import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ColumnDef } from '../components/DataTable'
import { toast } from 'sonner'
import { subtopicsApi, type Subtopic } from '../lib/api/subtopics'
import { topicsApi } from '../lib/api/topics'
import { makeOptimisticToggle } from '../lib/optimisticToggle'
import { isFirstInScope, isLastInScope } from '../lib/reorderBounds'
import { DataTable } from '../components/DataTable'
import { Modal } from '../components/Modal'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { ArchivedSection } from '../components/ArchivedSection'
import { ReorderButtons } from '../components/ReorderButtons'
import { EntityNameCell } from '../components/EntityNameCell'
import { TableRowActions } from '../components/TableRowActions'
import { Button, Field, SelectInput, TextInput, Toggle } from '../components/fields'

interface SubtopicFormState {
  name: string
  topic_id: string
}

const EMPTY_FORM: SubtopicFormState = { name: '', topic_id: '' }

export function SubtopicsPage() {
  const queryClient = useQueryClient()
  const activeQuery = useQuery({ queryKey: ['subtopics', false], queryFn: () => subtopicsApi.list(false) })
  const archivedQuery = useQuery({ queryKey: ['subtopics', true], queryFn: () => subtopicsApi.list(true) })
  const topicsQuery = useQuery({ queryKey: ['topics', false], queryFn: () => topicsApi.list(false) })

  const [editing, setEditing] = useState<Subtopic | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState<SubtopicFormState>(EMPTY_FORM)
  const [archiveTarget, setArchiveTarget] = useState<Subtopic | null>(null)

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['subtopics'] })
  }

  const saveMutation = useMutation({
    mutationFn: () => (editing ? subtopicsApi.update(editing.id, { ...form }) : subtopicsApi.create({ ...form })),
    onSuccess: () => {
      toast.success(editing ? 'Subtopic updated.' : 'Subtopic created.')
      setFormOpen(false)
      invalidate()
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Something went wrong.'),
  })

  const activeToggle = makeOptimisticToggle<Subtopic[]>(queryClient, ['subtopics', false], (list, id, active) =>
    list.map((item) => (item.id === id ? { ...item, active } : item)),
  )
  const setActiveMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => subtopicsApi.setActive(id, active),
    onMutate: activeToggle.onMutate,
    onError: (e, vars, context) => {
      activeToggle.onError(e, vars, context)
      toast.error(e instanceof Error ? e.message : 'Something went wrong.')
    },
    onSettled: invalidate,
  })

  const archiveMutation = useMutation({
    mutationFn: (id: string) => subtopicsApi.archive(id),
    onSuccess: () => {
      toast.success('Subtopic archived.')
      setArchiveTarget(null)
      invalidate()
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Something went wrong.'),
  })

  const restoreMutation = useMutation({
    mutationFn: (id: string) => subtopicsApi.restore(id),
    onSuccess: () => {
      toast.success('Subtopic restored — remember to re-enable Active if it should be visible again.')
      invalidate()
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Something went wrong.'),
  })

  const reorderMutation = useMutation({
    mutationFn: ({ id, direction }: { id: string; direction: 'up' | 'down' }) => subtopicsApi.reorder(id, direction),
    onSuccess: invalidate,
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Something went wrong.'),
  })

  const topics = topicsQuery.data ?? []

  function openCreate() {
    setEditing(null)
    setForm({ ...EMPTY_FORM, topic_id: topics[0]?.id ?? '' })
    setFormOpen(true)
  }

  function openEdit(subtopic: Subtopic) {
    setEditing(subtopic)
    setForm({ name: subtopic.name, topic_id: subtopic.topic_id })
    setFormOpen(true)
  }

  const activeSubtopics = activeQuery.data ?? []
  const subtopicScopeKey = (s: Subtopic) => s.topic_id

  const columns: ColumnDef<Subtopic>[] = [
    {
      id: 'reorder',
      header: '',
      className: 'w-px',
      cell: ({ row }) => {
        const index = activeSubtopics.findIndex((s) => s.id === row.original.id)
        return (
          <ReorderButtons
            onUp={() => reorderMutation.mutate({ id: row.original.id, direction: 'up' })}
            onDown={() => reorderMutation.mutate({ id: row.original.id, direction: 'down' })}
            disableUp={isFirstInScope(activeSubtopics, index, subtopicScopeKey)}
            disableDown={isLastInScope(activeSubtopics, index, subtopicScopeKey)}
            busy={reorderMutation.isPending}
          />
        )
      },
    },
    {
      accessorKey: 'name',
      header: 'Name',
      className: 'w-px',
      cell: ({ row }) => <EntityNameCell name={row.original.name} iconUrl={row.original.icon_url} kind="subtopic" />,
    },
    {
      accessorKey: 'topicName',
      header: 'Topic',
      className: 'w-full max-w-0',
      cell: (c) => {
        const topicName = c.getValue<string>()
        return <span className="block truncate" title={topicName}>{topicName}</span>
      },
    },
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
          editLabel="Edit subtopic"
          archiveLabel="Archive subtopic"
          onEdit={() => openEdit(row.original)}
          onArchive={() => setArchiveTarget(row.original)}
        />
      ),
    },
  ]

  const archivedColumns: ColumnDef<Subtopic>[] = [
    {
      accessorKey: 'name',
      header: 'Name',
      className: 'w-px',
      cell: ({ row }) => <EntityNameCell name={row.original.name} iconUrl={row.original.icon_url} kind="subtopic" />,
    },
    {
      accessorKey: 'topicName',
      header: 'Topic',
      className: 'w-full max-w-0',
      cell: (c) => {
        const topicName = c.getValue<string>()
        return <span className="block truncate" title={topicName}>{topicName}</span>
      },
    },
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
          <h1 className="text-lg font-semibold text-slate-900">Subtopics</h1>
          <p className="text-sm text-slate-500">Optional finer split under a topic (e.g. Tense under Grammar).</p>
        </div>
        <Button onClick={openCreate} disabled={topics.length === 0}>
          Add Subtopic
        </Button>
      </div>

      {topics.length === 0 && <p className="mb-4 text-sm text-amber-600">Add a topic first — a subtopic needs one to belong to.</p>}

      <DataTable columns={columns} data={activeSubtopics} emptyMessage="No subtopics yet." fitContainer />

      <ArchivedSection count={archivedQuery.data?.length ?? 0}>
        <DataTable columns={archivedColumns} data={archivedQuery.data ?? []} dimmed emptyMessage="No archived subtopics." fitContainer />
      </ArchivedSection>

      <Modal open={formOpen} onOpenChange={setFormOpen} title={editing ? 'Edit Subtopic' : 'Add Subtopic'}>
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
            <SelectInput required value={form.topic_id} onChange={(e) => setForm({ ...form, topic_id: e.target.value })}>
              {topics.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
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
        title="Archive this subtopic?"
        message={`"${archiveTarget?.name}" will be hidden from active lists and every dropdown across the admin. It stays in the database and can be restored later.`}
        confirmLabel="Archive"
        busy={archiveMutation.isPending}
        onConfirm={() => archiveTarget && archiveMutation.mutate(archiveTarget.id)}
      />
    </div>
  )
}
