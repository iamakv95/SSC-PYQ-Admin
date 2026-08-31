import { callAdminFunction } from '../adminApi'
import type { ContentStatus, PyqShift, PyqTier, QuestionType } from './questions'

export type QuizScope = 'topic' | 'subject'

export interface FixedQuiz {
  id: string
  title: string
  quiz_type: QuestionType
  scope: QuizScope
  topic_id: string | null
  subject_id: string | null
  exam_id: string | null
  pyq_year: number | null
  pyq_tier: PyqTier | null
  pyq_shift: PyqShift | null
  pyq_date: string | null
  time_limit_minutes: number | null
  locked: boolean
  status: ContentStatus
  active: boolean
  archived: boolean
  created_at: string
  updated_at: string
  topicName: string | null
  subjectName: string | null
  examName: string | null
  questionCount: number
}

export const fixedQuizzesApi = {
  list: (archived: boolean) =>
    callAdminFunction<{ items: FixedQuiz[] }>('admin-fixed-quizzes', { action: 'list', archived }).then(
      (r) => r.items,
    ),
  create: (fields: Record<string, unknown>, questionIds: string[]) =>
    callAdminFunction<{ item: FixedQuiz }>('admin-fixed-quizzes', { action: 'create', fields, questionIds }).then(
      (r) => r.item,
    ),
  update: (id: string, fields: Record<string, unknown>, questionIds: string[]) =>
    callAdminFunction<{ item: FixedQuiz }>('admin-fixed-quizzes', {
      action: 'update',
      id,
      fields,
      questionIds,
    }).then((r) => r.item),
  getQuestionIds: (id: string) =>
    callAdminFunction<{ questionIds: string[] }>('admin-fixed-quizzes', { action: 'getQuestionIds', id }).then(
      (r) => r.questionIds,
    ),
  setActive: (id: string, active: boolean) =>
    callAdminFunction<{ item: FixedQuiz }>('admin-fixed-quizzes', { action: 'setActive', id, active }).then(
      (r) => r.item,
    ),
  archive: (id: string) =>
    callAdminFunction<{ item: FixedQuiz }>('admin-fixed-quizzes', { action: 'archive', id }).then((r) => r.item),
  restore: (id: string) =>
    callAdminFunction<{ item: FixedQuiz }>('admin-fixed-quizzes', { action: 'restore', id }).then((r) => r.item),
}
