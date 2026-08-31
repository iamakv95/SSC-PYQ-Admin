import { callAdminFunction } from '../adminApi'
import type { Difficulty, LangContent, QuestionType, ContentStatus } from './questions'

export type ReportReason = 'wrong_answer' | 'unclear_text' | 'duplicate' | 'other'
export type ReportStatus = 'open' | 'resolved'

export interface ReportQuestion {
  id: string
  text: LangContent
  type: QuestionType
  difficulty: Difficulty
  status: ContentStatus
  active: boolean
  archived: boolean
}

export interface QuestionReport {
  id: string
  question_id: string
  reason: ReportReason
  note: string | null
  status: ReportStatus
  created_at: string
  resolved_at: string | null
  questions: ReportQuestion | null
}

export const questionReportsApi = {
  list: (status: ReportStatus | 'all', page = 0, pageSize = 50) =>
    callAdminFunction<{ items: QuestionReport[]; total: number }>('admin-question-reports', {
      action: 'list',
      status,
      page,
      pageSize,
    }),
  setStatus: (id: string, status: ReportStatus) =>
    callAdminFunction<{ item: Pick<QuestionReport, 'id' | 'status' | 'resolved_at'> }>('admin-question-reports', {
      action: 'setStatus',
      id,
      status,
    }).then((result) => result.item),
}
