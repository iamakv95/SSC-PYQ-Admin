import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ColumnDef } from '../components/DataTable'
import { toast } from 'sonner'
import { subjectsApi, type Subject } from '../lib/api/subjects'
import { examsApi } from '../lib/api/exams'
import { makeOptimisticToggle } from '../lib/optimisticToggle'
import { isFirstInScope, isLastInScope } from '../lib/reorderBounds'
import { DataTable } from '../components/DataTable'
import { Modal } from '../components/Modal'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { ArchivedSection } from '../components/ArchivedSection'
import { ReorderButtons } from '../components/ReorderButtons'
import { EntityNameCell } from '../components/EntityNameCell'
import { TableRowActions } from '../components/TableRowActions'
import { Button, Field, MultiSelectList, TextInput, Toggle } from '../components/fields'

interface SubjectFormState {
  name: string
  examIds: string[]
}

const EMPTY_FORM: SubjectFormState = { name: '', examIds: [] }

export function SubjectsPage() {
  const queryClient = useQueryClient()
  const activeQuery = useQuery({ queryKey: ['subjects', false], queryFn: () => subjectsApi.list(false) })
  const archivedQuery = useQuery({ queryKey: ['subjects', true], queryFn: () => subjectsApi.list(true) })
  const examsQuery = useQuery({ queryKey: ['exams', false], queryFn: () => examsApi.list(false) })

  const [editing, setEditing] = useState<Subject | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState<SubjectFormState>(EMPTY_FORM)
  const [archiveTarget, setArchiveTarget] = useState<Subject | null>(null)

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['subjects'] })
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      const saved = editing ? await subjectsApi.update(editing.id, { name: form.name }) : await subjectsApi.create({ name: form.name })
      await subjectsApi.setExamLinks(saved.id, form.examIds)
      return saved
    },
    onSuccess: () => {
      toast.success(editing ? 'Subject updated.' : 'Subject created.')
      setFormOpen(false)
      invalidate()
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Something went wrong.'),
  })

  const activeToggle = makeOptimisticToggle<Subject[]>(queryClient, ['subjects', false], (list, id, active) =>
    list.map((item) => (item.id === id ? { ...item, active } : item)),
  )
  const setActiveMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => subjectsApi.setActive(id, active),
    onMutate: activeToggle.onMutate,
    onError: (e, vars, context) => {
      activeToggle.onError(e, vars, context)
      toast.error(e instanceof Error ? e.message : 'Something went wrong.')
    },
    onSettled: invalidate,
  })

  const archiveMutation = useMutation({
    mutationFn: (id: string) => subjectsApi.archive(id),
    onSuccess: () => {
      toast.success('Subject archived.')
      setArchiveTarget(null)
      invalidate()
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Something went wrong.'),
  })

  const restoreMutation = useMutation({
    mutationFn: (id: string) => subjectsApi.restore(id),
    onSuccess: () => {
      toast.success('Subject restored — remember to re-enable Active if it should be visible again.')
      invalidate()
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Something went wrong.'),
  })

  const reorderMutation = useMutation({
    mutationFn: ({ id, direction }: { id: string; direction: 'up' | 'down' }) => subjectsApi.reorder(id, direction),
    onSuccess: invalidate,
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Something went wrong.'),
  })

  function openCreate() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setFormOpen(true)
  }

  function openEdit(subject: Subject) {
    setEditing(subject)
    setForm({ name: subject.name, examIds: subject.examIds })
    setFormOpen(true)
  }

  const examOptions = (examsQuery.data ?? []).map((e) => ({ id: e.id, label: e.name }))
  const examNameById = new Map(examOptions.map((e) => [e.id, e.label]))

  const activeSubjects = activeQuery.data ?? []

  const columns: ColumnDef<Subject>[] = [
    {
      id: 'reorder',
      header: '',
      className: 'w-px',
      cell: ({ row }) => {
        const index = activeSubjects.findIndex((s) => s.id === row.original.id)
        return (
          <ReorderButtons
            onUp={() => reorderMutation.mutate({ id: row.original.id, direction: 'up' })}
            onDown={() => reorderMutation.mutate({ id: row.original.id, direction: 'down' })}
            disableUp={isFirstInScope(activeSubjects, index)}
            disableDown={isLastInScope(activeSubjects, index)}
            busy={reorderMutation.isPending}
          />
        )
      },
    },
    {
      accessorKey: 'name',
      header: 'Name',
      className: 'w-px',
      cell: ({ row }) => <EntityNameCell name={row.original.name} iconUrl={row.original.icon_url} kind="subject" />,
    },
    {
      id: 'exams',
      header: 'Linked exams',
      className: 'w-full max-w-0',
      cell: ({ row }) =>
        row.original.examIds.length === 0 ? (
          <span className="text-slate-300">Universal (no exams linked)</span>
        ) : (
          <span className="block truncate" title={row.original.examIds.map((id: string) => examNameById.get(id) ?? id).join(', ')}>
            {row.original.examIds.map((id: string) => examNameById.get(id) ?? id).join(', ')}
          </span>
        ),
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
        <TableRowActions
          editLabel="Edit subject"
          archiveLabel="Archive subject"
          onEdit={() => openEdit(row.original)}
          onArchive={() => setArchiveTarget(row.original)}
        />
      ),
    },
  ]

  const archivedColumns: ColumnDef<Subject>[] = [
    {
      accessorKey: 'name',
      header: 'Name',
      className: 'w-full max-w-0',
      cell: ({ row }) => <EntityNameCell name={row.original.name} iconUrl={row.original.icon_url} kind="subject" />,
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
          <h1 className="text-lg font-semibold text-slate-900">Subjects</h1>
          <p className="text-sm text-slate-500">Shared across exams — exam links are for admin filtering only.</p>
        </div>
        <Button onClick={openCreate}>Add Subject</Button>
      </div>

      <DataTable columns={columns} data={activeSubjects} emptyMessage="No subjects yet." fitContainer />

      <ArchivedSection count={archivedQuery.data?.length ?? 0}>
        <DataTable columns={archivedColumns} data={archivedQuery.data ?? []} dimmed emptyMessage="No archived subjects." fitContainer />
      </ArchivedSection>

      <Modal open={formOpen} onOpenChange={setFormOpen} title={editing ? 'Edit Subject' : 'Add Subject'}>
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
          <Field label="Linked exams" hint="Admin filtering/organization only — never used to scope dynamic quizzes.">
            <MultiSelectList options={examOptions} selected={form.examIds} onChange={(examIds) => setForm({ ...form, examIds })} />
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
        title="Archive this subject?"
        message={`"${archiveTarget?.name}" will be hidden from active lists and every dropdown across the admin (including its topics' Subject picker). It stays in the database and can be restored later.`}
        confirmLabel="Archive"
        busy={archiveMutation.isPending}
        onConfirm={() => archiveTarget && archiveMutation.mutate(archiveTarget.id)}
      />
    </div>
  )
}
