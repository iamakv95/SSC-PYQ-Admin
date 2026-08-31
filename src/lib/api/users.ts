import { callAdminFunction } from '../adminApi'

export interface AdminUser {
  id: string
  email: string | null
  displayName: string
  avatarUrl: string | null
  isGuest: boolean
  isPro: boolean
  examName: string | null
  xpTotal: number
  currentStreak: number
  onboardingStep: string
  createdAt: string
  lastSignInAt: string | null
}

export type UserCategory = 'all' | 'real' | 'guest'

export const usersApi = {
  list: (category: UserCategory, page = 0, pageSize = 50) =>
    callAdminFunction<{ items: AdminUser[]; total: number }>('admin-users', {
      action: 'list',
      category,
      page,
      pageSize,
    }),
}
