import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'

/**
 * Admin sign-in (build spec Step 12 infra — not spec'd in the content-management doc, which is
 * silent on how the admin tool itself authenticates). Email + password, chosen over Google
 * OAuth specifically to avoid needing a new web OAuth redirect URI registered in Google Cloud
 * Console before this can work at all — Supabase's signInWithPassword/signUp work immediately
 * with no extra credential setup.
 *
 * There's no self-serve "become an admin" step — signing up here only creates a normal
 * Supabase auth user. A separate, manual `insert into admin_users` (service_role only, no RLS
 * policy grants anyone else access) is what actually grants admin access; see useAdminGate.
 */
export function LoginPage() {
  const [mode, setMode] = useState<'signIn' | 'signUp'>('signIn')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setInfo(null)
    setSubmitting(true)
    try {
      if (mode === 'signIn') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      } else {
        const { data, error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        if (!data.session) {
          setInfo('Account created — check your email to confirm it, then sign in.')
          setMode('signIn')
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">SSC Prep — Admin</h1>
        <p className="mt-1 text-sm text-slate-500">
          {mode === 'signIn' ? 'Sign in to manage content.' : 'Create an admin account.'}
        </p>

        {error && (
          <div className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
        )}
        {info && (
          <div className="mt-4 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{info}</div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
            Email
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-500"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
            Password
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-500"
            />
          </label>
          <button
            type="submit"
            disabled={submitting}
            className="mt-2 rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {submitting ? 'Please wait…' : mode === 'signIn' ? 'Sign in' : 'Sign up'}
          </button>
        </form>

        <button
          type="button"
          onClick={() => {
            setMode(mode === 'signIn' ? 'signUp' : 'signIn')
            setError(null)
            setInfo(null)
          }}
          className="mt-4 text-sm text-slate-500 underline underline-offset-2"
        >
          {mode === 'signIn' ? 'Need an account? Sign up' : 'Already have an account? Sign in'}
        </button>
      </div>
    </div>
  )
}
