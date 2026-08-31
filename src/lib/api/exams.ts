import { type BaseEntity, createSimpleEntityApi } from './simpleEntity'

export interface Exam extends BaseEntity {
  description: string | null
  display_order: number
}

export const examsApi = createSimpleEntityApi<Exam>('admin-exams')
