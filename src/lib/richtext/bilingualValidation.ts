import type { QuestionOption } from '../api/questions'

// Mirrors supabase/migrations/20260101000005_storage_and_bilingual_validation.sql's
// trg_validate_bilingual_question EXACTLY, for instant form feedback — the DB trigger is the
// real source of truth (this is a UX convenience, not a replacement; a request that somehow
// passes this check but fails the trigger still surfaces the trigger's own error message
// cleanly, see questions API's error handling).

function isNonBlank(value: string | undefined | null): boolean {
  return typeof value === 'string' && value.trim().length > 0
}

export function isOptionLangComplete(options: QuestionOption[], lang: 'en' | 'hi'): boolean {
  return options.every((opt) => isNonBlank(opt[lang]?.value))
}

export function isLangComplete(text: string | undefined, options: QuestionOption[], lang: 'en' | 'hi'): boolean {
  return isNonBlank(text) && isOptionLangComplete(options, lang)
}

export interface BilingualCheck {
  enComplete: boolean
  hiComplete: boolean
  valid: boolean
}

/** At least one language (English or Hindi) must have a complete question text + all 4 options
 * — neither language is specifically mandatory (admin doc §9, amended). Explanation is
 * excluded from the check entirely (admin doc §11 — now optional outright). */
export function checkBilingualComplete(textEn: string | undefined, textHi: string | undefined, options: QuestionOption[]): BilingualCheck {
  const enComplete = isLangComplete(textEn, options, 'en')
  const hiComplete = isLangComplete(textHi, options, 'hi')
  return { enComplete, hiComplete, valid: enComplete || hiComplete }
}

/** Passage text, if present at all, must have content in at least one language. */
export function isPassageValid(passageEn: string | undefined, passageHi: string | undefined): boolean {
  const hasEn = isNonBlank(passageEn)
  const hasHi = isNonBlank(passageHi)
  // "if present" — an entirely blank passage in both languages is only invalid if the admin
  // intended to add one at all; treat "both blank" as "no passage", not an error, so a never-
  // touched optional field doesn't block saving.
  if (!hasEn && !hasHi) return true
  return hasEn || hasHi
}
