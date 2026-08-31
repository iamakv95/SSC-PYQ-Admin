import { callAdminFunction } from '../adminApi'

export interface BaseEntity {
  id: string
  name: string
  icon_url?: string | null
  active: boolean
  archived: boolean
  created_at: string
  updated_at: string
}

/**
 * Shared list/create/update/setActive/archive/restore client, mirroring
 * supabase/functions/_shared/simpleEntity.ts's shared handler on the server side — one place
 * for the 5 simple hierarchy entities' common actions, so each entity's own api/*.ts file only
 * needs to add what's actually different about it (extra fields, extra relationship actions).
 */
export function createSimpleEntityApi<T extends BaseEntity>(functionName: string) {
  return {
    list: (archived: boolean) =>
      callAdminFunction<{ items: T[] }>(functionName, { action: 'list', archived }).then((r) => r.items),
    create: (fields: Record<string, unknown>) =>
      callAdminFunction<{ item: T }>(functionName, { action: 'create', fields }).then((r) => r.item),
    update: (id: string, fields: Record<string, unknown>) =>
      callAdminFunction<{ item: T }>(functionName, { action: 'update', id, fields }).then((r) => r.item),
    setActive: (id: string, active: boolean) =>
      callAdminFunction<{ item: T }>(functionName, { action: 'setActive', id, active }).then((r) => r.item),
    archive: (id: string) =>
      callAdminFunction<{ item: T }>(functionName, { action: 'archive', id }).then((r) => r.item),
    restore: (id: string) =>
      callAdminFunction<{ item: T }>(functionName, { action: 'restore', id }).then((r) => r.item),
    // Only meaningful for the 4 entities with a display_order column (exams, subjects, topics,
    // subtopics) — present on every entity for the same reason setActive/archive/restore are,
    // but concept_tags' page simply never calls it.
    reorder: (id: string, direction: 'up' | 'down') =>
      callAdminFunction<{ moved: boolean }>(functionName, { action: 'reorder', id, direction }).then((r) => r.moved),
  }
}
