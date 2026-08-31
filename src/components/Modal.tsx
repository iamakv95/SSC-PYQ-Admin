import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import type { ReactNode } from 'react'

interface ModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  children: ReactNode
  /** Wider modal for content-heavy forms (Question Bank, Fixed Quiz Builder). */
  wide?: boolean
}

export function Modal({ open, onOpenChange, title, children, wide = false }: ModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-slate-900/40" />
        <Dialog.Content
          className={`fixed left-1/2 top-1/2 max-h-[90vh] w-full -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl bg-white p-6 shadow-xl ${
            wide ? 'max-w-5xl' : 'max-w-lg'
          }`}
        >
          <div className="mb-4 flex items-center justify-between">
            <Dialog.Title className="text-base font-semibold text-slate-900">{title}</Dialog.Title>
            <Dialog.Close className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
              <X size={18} />
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
