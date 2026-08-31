import { useState } from 'react'
import { BookMarked, Layers, ListTree, Trophy, type LucideIcon } from 'lucide-react'

type EntityKind = 'exam' | 'subject' | 'topic' | 'subtopic'

const FALLBACK_ICONS: Record<EntityKind, LucideIcon> = {
  exam: Trophy,
  subject: BookMarked,
  topic: Layers,
  subtopic: ListTree,
}

interface EntityNameCellProps {
  name: string
  iconUrl?: string | null
  kind: EntityKind
}

/** Database icon with an entity-specific Lucide fallback for hierarchy tables. */
export function EntityNameCell({ name, iconUrl, kind }: EntityNameCellProps) {
  const [failedIconUrl, setFailedIconUrl] = useState<string | null>(null)
  const FallbackIcon = FALLBACK_ICONS[kind]

  return (
    <div className="flex min-w-0 items-center gap-3">
      {iconUrl && failedIconUrl !== iconUrl ? (
        <img
          src={iconUrl}
          alt=""
          loading="lazy"
          className="h-9 w-9 shrink-0 rounded-lg bg-slate-100 object-contain"
          onError={() => setFailedIconUrl(iconUrl)}
        />
      ) : (
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
          <FallbackIcon aria-hidden="true" size={19} strokeWidth={1.75} />
        </span>
      )}
      <span className="truncate font-medium text-slate-900">{name}</span>
    </div>
  )
}
