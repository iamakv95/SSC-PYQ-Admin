import { Modal } from './Modal'

interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  message: string
  confirmLabel: string
  onConfirm: () => void
  busy?: boolean
}

export function ConfirmDialog({ open, onOpenChange, title, message, confirmLabel, onConfirm, busy }: ConfirmDialogProps) {
  return (
    <Modal open={open} onOpenChange={onOpenChange} title={title}>
      <p className="text-sm text-slate-600">{message}</p>
      <div className="mt-6 flex justify-end gap-2">
        <button
          onClick={() => onOpenChange(false)}
          disabled={busy}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          disabled={busy}
          className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
        >
          {busy ? 'Working…' : confirmLabel}
        </button>
      </div>
    </Modal>
  )
}
