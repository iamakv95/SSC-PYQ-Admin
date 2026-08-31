import { type BaseEntity, createSimpleEntityApi } from './simpleEntity'

export interface Subtopic extends BaseEntity {
  topic_id: string
  topicName: string | null
  display_order: number
  questionCount: number
}

export const subtopicsApi = createSimpleEntityApi<Subtopic>('admin-subtopics')
