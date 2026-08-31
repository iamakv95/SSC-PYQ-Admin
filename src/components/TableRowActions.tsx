import { Archive as ArchiveIcon, Pencil } from 'lucide-react'

import { Button } from './fields'

interface TableRowActionsProps {
  editLabel: string
  onEdit: () => void
  archiveLabel?: string
  onArchive?: () => void
}

/** Compact, accessible actions shared by admin list tables. */
export function TableRowActions({ editLabel, onEdit, archiveLabel, onArchive }: TableRowActionsProps) {
  return (
    <div className="flex gap-1">
      <Button variant="ghost" className="!p-1.5" aria-label={editLabel} title="Edit" onClick={onEdit}>
        <Pencil aria-hidden="true" size={16} />
      </Button>
      {onArchive && archiveLabel && (
        <Button variant="ghost" className="!p-1.5" aria-label={archiveLabel} title="Archive" onClick={onArchive}>
          <ArchiveIcon aria-hidden="true" size={16} />
        </Button>
      )}
    </div>
  )
}
