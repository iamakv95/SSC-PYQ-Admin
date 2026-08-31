import { supabase } from './supabase'

const FUNCTIONS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`

/**
 * Every admin write (and every admin read of Draft/Inactive/Archived content) goes through a
 * Supabase Edge Function using service_role server-side — never a direct client write/read
 * with the anon/authenticated key (CLAUDE.md non-negotiable; the content tables' own RLS SELECT
 * policy filters to Published/Active/non-Archived only, so even listing needs this).
 *
 * Reads the current session's access token directly and does its own fetch, rather than
 * supabase-js's `functions.invoke()` — that wraps a non-2xx response in a FunctionsHttpError
 * whose body isn't trivially readable, whereas every one of these functions already returns a
 * predictable `{ error: string }` JSON body on failure that's more useful surfaced directly.
 */
export async function callAdminFunction<T = unknown>(
  functionName: string,
  body: Record<string, unknown>,
): Promise<T> {
  const { data: sessionData } = await supabase.auth.getSession()
  const accessToken = sessionData.session?.access_token
  if (!accessToken) throw new Error('Not signed in.')

  const res = await fetch(`${FUNCTIONS_URL}/${functionName}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body),
  })

  const json = await res.json().catch(() => null)
  if (!res.ok) {
    const message = (json && typeof json === 'object' && 'error' in json && String(json.error)) || `Request failed (${res.status})`
    throw new Error(message)
  }
  return json as T
}
