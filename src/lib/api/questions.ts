import { callAdminFunction } from '../adminApi'

export type Lang = 'en' | 'hi'
export type QuestionType = 'PYQ' | 'Practice'
export type Difficulty = 'easy' | 'medium' | 'hard'
export type ContentStatus = 'Draft' | 'Published'
export type PyqTier = 'Tier 1' | 'Tier 2' | 'Tier 3' | 'Tier 4'
export type PyqShift = 'Shift 1' | 'Shift 2' | 'Shift 3' | 'Shift 4'

/** Each language's content is wrapped `{type, value}` — for text/explanation/passage_text
 * `type` is always `'text'` and `value` holds the Markdown-lite string (admin doc §10); options
 * are the only field where `type` can be `'image'` (non-verbal-reasoning image options). This
 * wrapper shape matches the mobile app's `LangBlock`/`LangContent` (apps/mobile/services/
 * quizEngine.ts) exactly, which is the real, already-live shape of every question row — don't
 * reintroduce a plain-string assumption here. Either language key may be absent/blank; at least
 * one language's text + all 4 options must be complete (trg_validate_bilingual_question is the
 * real source of truth for this — see richtext/bilingualValidation.ts for the mirrored check). */
export interface LangBlock {
  type: 'text' | 'image'
  value: string
}

export type LangContent = Partial<Record<Lang, LangBlock>>

/** Alias kept for options call sites — identical shape to LangBlock. */
export type OptionValue = LangBlock

/** A language key can be entirely absent on an option (e.g. an English-only PYQ question never
 * had Hindi options written) — never assume both keys are present. */
export type QuestionOption = Partial<Record<Lang, OptionValue>>

export interface Question {
  id: string
  subject_id: string
  topic_id: string
  subtopic_id: string | null
  concept_tag_id: string | null
  text: LangContent
  options: QuestionOption[]
  correct_index: number
  explanation: LangContent | null
  /** Legacy column (migration 20260126000001) — untouched on old rows but no longer written by
   * this admin form, which only ever sets passage_id going forward. Kept in the type since the
   * column (and its old values) still exist in the DB and `select('*')` still returns it. */
  passage_text: LangContent | null
  passage_id: string | null
  type: QuestionType
  difficulty: Difficulty
  positive_marks: number
  negative_marks: number
  status: ContentStatus
  active: boolean
  archived: boolean
  exam_id: string | null
  pyq_year: number | null
  pyq_tier: PyqTier | null
  pyq_shift: PyqShift | null
  pyq_date: string | null
  created_at: string
  updated_at: string
}

export interface QuestionFilters {
  examId?: string
  subjectId?: string
  topicId?: string
  subtopicId?: string
  conceptTagId?: string
  passageId?: string
  type?: QuestionType
  difficulty?: Difficulty
  status?: ContentStatus
  active?: boolean
  search?: string
  pyqYear?: number
  pyqTier?: string
  pyqShift?: string
  pyqDate?: string
}

export const questionsApi = {
  list: (archived: boolean, filters: QuestionFilters, page: number, pageSize: number) =>
    callAdminFunction<{ items: Question[]; total: number }>('admin-questions', {
      action: 'list',
      archived,
      filters,
      page,
      pageSize,
    }),
  create: (fields: Record<string, unknown>, examIds?: string[]) =>
    callAdminFunction<{ item: Question }>('admin-questions', { action: 'create', fields, examIds }).then((r) => r.item),
  update: (id: string, fields: Record<string, unknown>, examIds?: string[]) =>
    callAdminFunction<{ item: Question }>('admin-questions', { action: 'update', id, fields, examIds }).then(
      (r) => r.item,
    ),
  setActive: (id: string, active: boolean) =>
    callAdminFunction<{ item: Question }>('admin-questions', { action: 'setActive', id, active }).then((r) => r.item),
  archive: (id: string) =>
    callAdminFunction<{ item: Question }>('admin-questions', { action: 'archive', id }).then((r) => r.item),
  restore: (id: string) =>
    callAdminFunction<{ item: Question }>('admin-questions', { action: 'restore', id }).then((r) => r.item),
  getExamIds: (id: string) =>
    callAdminFunction<{ examIds: string[] }>('admin-questions', { action: 'getExamIds', id }).then((r) => r.examIds),
  /** Plain lookup by id, independent of list's filters/pagination — used by the Passages page's
   * "edit this attached question" links, which land on Question Bank with only an id. */
  getById: (id: string) => callAdminFunction<{ item: Question }>('admin-questions', { action: 'getById', id }).then((r) => r.item),
}
