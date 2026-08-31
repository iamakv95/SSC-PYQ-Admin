import { type BaseEntity, createSimpleEntityApi } from './simpleEntity'

export interface Topic extends BaseEntity {
  subject_id: string
  subjectName: string | null
  display_order: number
  questionCount: number
}

export const topicsApi = createSimpleEntityApi<Topic>('admin-topics')
