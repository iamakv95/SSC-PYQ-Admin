import { callAdminFunction } from '../adminApi'

export type FeedbackCategory = 'suggestion' | 'bug' | 'ui' | 'general'
export type FeedbackStatus = 'new' | 'reviewed' | 'resolved'

export interface AppFeedback {
  id: string
  user_id: string | null
  category: FeedbackCategory
  message: string
  app_version: string | null
  device_info: string | null
  status: FeedbackStatus
  created_at: string
}

export const appFeedbackApi = {
  list: (status: FeedbackStatus | 'all' = 'all', category: FeedbackCategory | 'all' = 'all', page = 0, pageSize = 50) =>
    callAdminFunction<{ items: AppFeedback[]; total: number }>('admin-app-feedback', {
      action: 'list',
      status,
      category,
      page,
      pageSize,
    }),
  setStatus: (id: string, status: FeedbackStatus) =>
    callAdminFunction<{ item: Pick<AppFeedback, 'id' | 'status'> }>('admin-app-feedback', {
      action: 'setStatus',
      id,
      status,
    }).then((result) => result.item),
}
