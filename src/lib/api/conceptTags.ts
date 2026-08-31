import { type BaseEntity, createSimpleEntityApi } from './simpleEntity'

export interface ConceptTag extends BaseEntity {
  topic_id: string
  subtopic_id: string | null
  topicName: string | null
  subtopicName: string | null
  questionCount: number
}

export const conceptTagsApi = createSimpleEntityApi<ConceptTag>('admin-concept-tags')
