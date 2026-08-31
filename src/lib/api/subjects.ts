import { callAdminFunction } from '../adminApi'
import { type BaseEntity, createSimpleEntityApi } from './simpleEntity'

export interface Subject extends BaseEntity {
  /** Exam ids this subject is linked to — admin filtering only (admin doc §1), never used to
   * scope dynamic quizzes. */
  examIds: string[]
  display_order: number
}

const base = createSimpleEntityApi<Subject>('admin-subjects')

export const subjectsApi = {
  ...base,
  /** Replaces the full linked-exam set in one call, matching a multi-select checkbox UI. */
  setExamLinks: (id: string, examIds: string[]) =>
    callAdminFunction<{ ok: true }>('admin-subjects', { action: 'setExamLinks', id, examIds }),
}
