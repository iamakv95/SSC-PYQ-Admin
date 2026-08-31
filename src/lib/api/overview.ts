import { callAdminFunction } from '../adminApi'

interface ContentSummary {
  total: number
  draft: number
  published: number
  inactive: number
  draftActive: number
  publishedInactive: number
}

export interface AdminOverview {
  questions: ContentSummary
  fixedQuizzes: ContentSummary
  passages: { total: number }
  reports: { open: number }
  users: { total: number }
}

export const overviewApi = {
  get: () => callAdminFunction<AdminOverview>('admin-overview', { action: 'get' }),
}
