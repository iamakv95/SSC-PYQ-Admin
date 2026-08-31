import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ColumnDef } from '../components/DataTable'
import { toast } from 'sonner'
import { topicsApi, type Topic } from '../lib/api/topics'
import { subjectsApi } from '../lib/api/subjects'
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

interface TopicFormState {
  name: string
  subject_id: string
}

const EMPTY_FORM: TopicFormState = { name: '', subject_id: '' }

export function TopicsPage() {
  const queryClient = useQueryClient()
  const activeQuery = useQuery({ queryKey: ['topics', false], queryFn: () => topicsApi.list(false) })
  const archivedQuery = useQuery({ queryKey: ['topics', true], queryFn: () => topicsApi.list(true) })
  const subjectsQuery = useQuery({ queryKey: ['subjects', false], queryFn: () => subjectsApi.list(false) })

  const [editing, setEditing] = useState<Topic | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState<TopicFormState>(EMPTY_FORM)
  const [archiveTarget, setArchiveTarget] = useState<Topic | null>(null)

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['topics'] })
  }

  const saveMutation = useMutation({
    mutationFn: () =>
      editing ? topicsApi.update(editing.id, { ...form }) : topicsApi.create({ ...form }),
    onSuccess: () => {
      toast.success(editing ? 'Topic updated.' : 'Topic created.')
      setFormOpen(false)
      invalidate()
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Something went wrong.'),
  })

  const activeToggle = makeOptimisticToggle<Topic[]>(queryClient, ['topics', false], (list, id, active) =>
    list.map((item) => (item.id === id ? { ...item, active } : item)),
  )
  const setActiveMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => topicsApi.setActive(id, active),
    onMutate: activeToggle.onMutate,
    onError: (e, vars, context) => {
      activeToggle.onError(e, vars, context)
      toast.error(e instanceof Error ? e.message : 'Something went wrong.')
    },
    onSettled: invalidate,
  })

  const archiveMutation = useMutation({
    mutationFn: (id: string) => topicsApi.archive(id),
    onSuccess: () => {
      toast.success('Topic archived.')
      setArchiveTarget(null)
      invalidate()
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Something went wrong.'),
  })

  const restoreMutation = useMutation({
    mutationFn: (id: string) => topicsApi.restore(id),
    onSuccess: () => {
      toast.success('Topic restored — remember to re-enable Active if it should be visible again.')
      invalidate()
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Something went wrong.'),
  })

  const reorderMutation = useMutation({
    mutationFn: ({ id, direction }: { id: string; direction: 'up' | 'down' }) => topicsApi.reorder(id, direction),
    onSuccess: invalidate,
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Something went wrong.'),
  })

  const subjects = subjectsQuery.data ?? []

  function openCreate() {
    setEditing(null)
    setForm({ ...EMPTY_FORM, subject_id: subjects[0]?.id ?? '' })
    setFormOpen(true)
  }

  function openEdit(topic: Topic) {
    setEditing(topic)
    setForm({ name: topic.name, subject_id: topic.subject_id })
    setFormOpen(true)
  }

  const activeTopics = activeQuery.data ?? []
  const topicScopeKey = (t: Topic) => t.subject_id

  const columns: ColumnDef<Topic>[] = [
    {
      id: 'reorder',
      header: '',
      className: 'w-px',
      cell: ({ row }) => {
        const index = activeTopics.findIndex((t) => t.id === row.original.id)
        return (
          <ReorderButtons
            onUp={() => reorderMutation.mutate({ id: row.original.id, direction: 'up' })}
            onDown={() => reorderMutation.mutate({ id: row.original.id, direction: 'down' })}
            disableUp={isFirstInScope(activeTopics, index, topicScopeKey)}
            disableDown={isLastInScope(activeTopics, index, topicScopeKey)}
            busy={reorderMutation.isPending}
          />
        )
      },
    },
    {
      accessorKey: 'name',
      header: 'Name',
      className: 'w-px',
      cell: ({ row }) => <EntityNameCell name={row.original.name} iconUrl={row.original.icon_url} kind="topic" />,
    },
    {
      accessorKey: 'subjectName',
      header: 'Subject',
      className: 'w-full max-w-0',
      cell: (c) => {
        const subjectName = c.getValue<string>()
        return <span className="block truncate" title={subjectName}>{subjectName}</span>
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
          editLabel="Edit topic"
          archiveLabel="Archive topic"
          onEdit={() => openEdit(row.original)}
          onArchive={() => setArchiveTarget(row.original)}
        />
      ),
    },
  ]

  const archivedColumns: ColumnDef<Topic>[] = [
    {
      accessorKey: 'name',
      header: 'Name',
      className: 'w-px',
      cell: ({ row }) => <EntityNameCell name={row.original.name} iconUrl={row.original.icon_url} kind="topic" />,
    },
    {
      accessorKey: 'subjectName',
      header: 'Subject',
      className: 'w-full max-w-0',
      cell: (c) => {
        const subjectName = c.getValue<string>()
        return <span className="block truncate" title={subjectName}>{subjectName}</span>
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
          <h1 className="text-lg font-semibold text-slate-900">Topics</h1>
          <p className="text-sm text-slate-500">Each topic belongs to exactly one subject.</p>
        </div>
        <Button onClick={openCreate} disabled={subjects.length === 0}>
          Add Topic
        </Button>
      </div>

      {subjects.length === 0 && (
        <p className="mb-4 text-sm text-amber-600">Add a subject first — a topic needs one to belong to.</p>
      )}

      <DataTable columns={columns} data={activeTopics} emptyMessage="No topics yet." fitContainer />

      <ArchivedSection count={archivedQuery.data?.length ?? 0}>
        <DataTable columns={archivedColumns} data={archivedQuery.data ?? []} dimmed emptyMessage="No archived topics." fitContainer />
      </ArchivedSection>

      <Modal open={formOpen} onOpenChange={setFormOpen} title={editing ? 'Edit Topic' : 'Add Topic'}>
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
          <Field label="Subject">
            <SelectInput required value={form.subject_id} onChange={(e) => setForm({ ...form, subject_id: e.target.value })}>
              {subjects.map((s) => (
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
        title="Archive this topic?"
        message={`"${archiveTarget?.name}" will be hidden from active lists and every dropdown across the admin. It stays in the database and can be restored later.`}
        confirmLabel="Archive"
        busy={archiveMutation.isPending}
        onConfirm={() => archiveTarget && archiveMutation.mutate(archiveTarget.id)}
      />
    </div>
  )
}
