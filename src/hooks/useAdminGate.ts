import { useEffect, useState } from 'react'
import { examsApi } from '../lib/api/exams'

export type AdminGateStatus = 'checking' | 'authorized' | 'forbidden' | 'error'

/**
 * The admin tool has no RLS-checked "admin role" — every admin-* Edge Function decides that
 * itself via the admin_users table (see supabase/functions/_shared/adminAuth.ts). This hook
 * just probes with one cheap real call (exams list) to find out whether the CURRENT signed-in
 * user is actually authorized, so the UI can show a clear "not an admin" state instead of
 * silently rendering pages whose every button would 403.
 */
export function useAdminGate(enabled: boolean) {
  const [status, setStatus] = useState<AdminGateStatus>('checking')

  useEffect(() => {
    if (!enabled) return
    let active = true
    setStatus('checking')
    examsApi
      .list(false)
      .then(() => {
        if (active) setStatus('authorized')
      })
      .catch((e: unknown) => {
        if (!active) return
        const message = e instanceof Error ? e.message.toLowerCase() : ''
        setStatus(message.includes('not authorized') ? 'forbidden' : 'error')
      })
    return () => {
      active = false
    }
  }, [enabled])

  return status
}
