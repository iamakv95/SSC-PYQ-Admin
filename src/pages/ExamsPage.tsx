import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ColumnDef } from '../components/DataTable'
import { toast } from 'sonner'
import { examsApi, type Exam } from '../lib/api/exams'
import { makeOptimisticToggle } from '../lib/optimisticToggle'
import { isFirstInScope, isLastInScope } from '../lib/reorderBounds'
import { DataTable } from '../components/DataTable'
import { Modal } from '../components/Modal'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { ArchivedSection } from '../components/ArchivedSection'
import { ReorderButtons } from '../components/ReorderButtons'
import { EntityNameCell } from '../components/EntityNameCell'
import { TableRowActions } from '../components/TableRowActions'
import { Button, Field, TextArea, TextInput, Toggle } from '../components/fields'

interface ExamFormState {
  name: string
  description: string
}

const EMPTY_FORM: ExamFormState = { name: '', description: '' }

export function ExamsPage() {
  const queryClient = useQueryClient()
  const activeQuery = useQuery({ queryKey: ['exams', false], queryFn: () => examsApi.list(false) })
  const archivedQuery = useQuery({ queryKey: ['exams', true], queryFn: () => examsApi.list(true) })

  const [editing, setEditing] = useState<Exam | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState<ExamFormState>(EMPTY_FORM)
  const [archiveTarget, setArchiveTarget] = useState<Exam | null>(null)

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['exams'] })
  }

  const saveMutation = useMutation({
    mutationFn: () =>
      editing
        ? examsApi.update(editing.id, { name: form.name, description: form.description || null })
        : examsApi.create({ name: form.name, description: form.description || null }),
    onSuccess: () => {
      toast.success(editing ? 'Exam updated.' : 'Exam created.')
      setFormOpen(false)
      invalidate()
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Something went wrong.'),
  })

  const activeToggle = makeOptimisticToggle<Exam[]>(queryClient, ['exams', false], (list, id, active) =>
    list.map((item) => (item.id === id ? { ...item, active } : item)),
  )
  const setActiveMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => examsApi.setActive(id, active),
    onMutate: activeToggle.onMutate,
    onError: (e, vars, context) => {
      activeToggle.onError(e, vars, context)
      toast.error(e instanceof Error ? e.message : 'Something went wrong.')
    },
    onSettled: invalidate,
  })

  const archiveMutation = useMutation({
    mutationFn: (id: string) => examsApi.archive(id),
    onSuccess: () => {
      toast.success('Exam archived.')
      setArchiveTarget(null)
      invalidate()
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Something went wrong.'),
  })

  const restoreMutation = useMutation({
    mutationFn: (id: string) => examsApi.restore(id),
    onSuccess: () => {
      toast.success('Exam restored — remember to re-enable Active if it should be visible again.')
      invalidate()
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Something went wrong.'),
  })

  const reorderMutation = useMutation({
    mutationFn: ({ id, direction }: { id: string; direction: 'up' | 'down' }) => examsApi.reorder(id, direction),
    onSuccess: invalidate,
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Something went wrong.'),
  })

  function openCreate() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setFormOpen(true)
  }

  function openEdit(exam: Exam) {
    setEditing(exam)
    setForm({ name: exam.name, description: exam.description ?? '' })
    setFormOpen(true)
  }

  const activeExams = activeQuery.data ?? []

  const columns: ColumnDef<Exam>[] = [
    {
      id: 'reorder',
      header: '',
      className: 'w-px',
      cell: ({ row }) => {
        const index = activeExams.findIndex((e) => e.id === row.original.id)
        return (
          <ReorderButtons
            onUp={() => reorderMutation.mutate({ id: row.original.id, direction: 'up' })}
            onDown={() => reorderMutation.mutate({ id: row.original.id, direction: 'down' })}
            disableUp={isFirstInScope(activeExams, index)}
            disableDown={isLastInScope(activeExams, index)}
            busy={reorderMutation.isPending}
          />
        )
      },
    },
    {
      accessorKey: 'name',
      header: 'Name',
      className: 'w-px',
      cell: ({ row }) => <EntityNameCell name={row.original.name} iconUrl={row.original.icon_url} kind="exam" />,
    },
    {
      accessorKey: 'description',
      header: 'Description',
      className: 'w-full max-w-0',
      cell: (c) => {
        const description = c.getValue<string>()
        return description ? <span className="block truncate" title={description}>{description}</span> : <span className="text-slate-300">—</span>
      },
    },
    {
      id: 'active',
      header: 'Active',
      className: 'w-px',
      cell: ({ row }) => (
        <Toggle
          checked={row.original.active}
          onChange={(active) => setActiveMutation.mutate({ id: row.original.id, active })}
          label=""
        />
      ),
    },
    {
      id: 'actions',
      header: '',
      className: 'w-px',
      cell: ({ row }) => (
        <TableRowActions
          editLabel="Edit exam"
          archiveLabel="Archive exam"
          onEdit={() => openEdit(row.original)}
          onArchive={() => setArchiveTarget(row.original)}
        />
      ),
    },
  ]

  const archivedColumns: ColumnDef<Exam>[] = [
    {
      accessorKey: 'name',
      header: 'Name',
      className: 'w-px',
      cell: ({ row }) => <EntityNameCell name={row.original.name} iconUrl={row.original.icon_url} kind="exam" />,
    },
    {
      accessorKey: 'description',
      header: 'Description',
      className: 'w-full max-w-0',
      cell: (c) => {
        const description = c.getValue<string>()
        return description ? <span className="block truncate" title={description}>{description}</span> : <span className="text-slate-300">—</span>
      },
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

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Exams</h1>
          <p className="text-sm text-slate-500">SSC MTS, SSC CGL, SSC CHSL, and so on.</p>
        </div>
        <Button onClick={openCreate}>Add Exam</Button>
      </div>

      <DataTable columns={columns} data={activeExams} emptyMessage="No exams yet." fitContainer />

      <ArchivedSection count={archivedQuery.data?.length ?? 0}>
        <DataTable columns={archivedColumns} data={archivedQuery.data ?? []} dimmed emptyMessage="No archived exams." fitContainer />
      </ArchivedSection>

      <Modal open={formOpen} onOpenChange={setFormOpen} title={editing ? 'Edit Exam' : 'Add Exam'}>
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
          <Field label="Description" hint="Optional">
            <TextArea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
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
        title="Archive this exam?"
        message={`"${archiveTarget?.name}" will be hidden from active lists and every dropdown across the admin. It stays in the database and can be restored later.`}
        confirmLabel="Archive"
        busy={archiveMutation.isPending}
        onConfirm={() => archiveTarget && archiveMutation.mutate(archiveTarget.id)}
      />
    </div>
  )
}
