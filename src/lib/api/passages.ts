import { callAdminFunction } from '../adminApi'
import type { LangContent } from './questions'

export interface Passage {
  id: string
  subject_id: string
  topic_id: string
  subtopic_id: string | null
  text: LangContent
  created_at: string
  updated_at: string
}

/** `list()`'s result only — the count of questions currently attached, computed server-side via
 * a PostgREST aggregate embed (not stored on the row, so create/update responses don't have it). */
export interface PassageListItem extends Passage {
  question_count: number
}

/** No active/archived lifecycle (unlike the simple hierarchy entities) — a passage's visibility
 * is entirely governed by its linked questions' own status/active/archived. */
export const passagesApi = {
  /** Fetches every passage — QuestionForm filters client-side by the current topic_id, and the
   * Passages admin page filters client-side by subject/topic/search, same "fetch once, filter
   * per hierarchy selection" pattern QuestionsPage already uses for
   * subjects/topics/subtopics/conceptTags/exams. */
  list: () => callAdminFunction<{ items: PassageListItem[] }>('admin-passages', { action: 'list' }).then((r) => r.items),
  create: (fields: { subject_id: string; topic_id: string; subtopic_id: string | null; text: LangContent }) =>
    callAdminFunction<{ item: Passage }>('admin-passages', { action: 'create', fields }).then((r) => r.item),
  update: (id: string, fields: { subject_id: string; topic_id: string; subtopic_id: string | null; text: LangContent }) =>
    callAdminFunction<{ item: Passage }>('admin-passages', { action: 'update', id, fields }).then((r) => r.item),
}
