import type { Passage } from '../../lib/api/passages'
import type { Subject } from '../../lib/api/subjects'
import type { Topic } from '../../lib/api/topics'
import type { Subtopic } from '../../lib/api/subtopics'
import { RichTextEditor } from '../richtext/RichTextEditor'
import { Field, SelectInput } from '../fields'

export interface PassageFormValues {
  subject_id: string
  topic_id: string
  subtopic_id: string
  textEn: string
  textHi: string
}

export function initialPassageFormValues(passage: Passage | null, defaults: { subjectId: string }): PassageFormValues {
  if (!passage) {
    return { subject_id: defaults.subjectId, topic_id: '', subtopic_id: '', textEn: '', textHi: '' }
  }
  return {
    subject_id: passage.subject_id,
    topic_id: passage.topic_id,
    subtopic_id: passage.subtopic_id ?? '',
    textEn: passage.text.en?.value ?? '',
    textHi: passage.text.hi?.value ?? '',
  }
}

/** Unlike a question's passage fields (optional — "no passage" is a valid choice, see
 * QuestionForm.tsx's isPassageValid), a passage authored on this dedicated page has no reason to
 * exist blank in both languages — the whole point of the page is to author passage content. */
export function isPassageContentValid(textEn: string, textHi: string): boolean {
  return textEn.trim().length > 0 || textHi.trim().length > 0
}

export function toPassageFields(values: PassageFormValues) {
  return {
    subject_id: values.subject_id,
    topic_id: values.topic_id,
    subtopic_id: values.subtopic_id || null,
    text: {
      en: values.textEn ? { type: 'text' as const, value: values.textEn } : undefined,
      hi: values.textHi ? { type: 'text' as const, value: values.textHi } : undefined,
    },
  }
}

interface PassageFormProps {
  values: PassageFormValues
  onChange: (values: PassageFormValues) => void
  subjects: Subject[]
  topics: Topic[]
  subtopics: Subtopic[]
}

export function PassageForm({ values, onChange, subjects, topics, subtopics }: PassageFormProps) {
  const topicsForSubject = topics.filter((t) => t.subject_id === values.subject_id)
  const subtopicsForTopic = subtopics.filter((s) => s.topic_id === values.topic_id)
  const contentValid = isPassageContentValid(values.textEn, values.textHi)

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-3 gap-3">
        <Field label="Subject">
          <SelectInput
            value={values.subject_id}
            onChange={(e) => onChange({ ...values, subject_id: e.target.value, topic_id: '', subtopic_id: '' })}
          >
            <option value="">Select…</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </SelectInput>
        </Field>
        <Field label="Topic">
          <SelectInput
            value={values.topic_id}
            onChange={(e) => onChange({ ...values, topic_id: e.target.value, subtopic_id: '' })}
            disabled={!values.subject_id}
          >
            <option value="">Select…</option>
            {topicsForSubject.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </SelectInput>
        </Field>
        <Field label="Subtopic" hint="Optional">
          <SelectInput
            value={values.subtopic_id}
            onChange={(e) => onChange({ ...values, subtopic_id: e.target.value })}
            disabled={!values.topic_id}
          >
            <option value="">None</option>
            {subtopicsForTopic.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </SelectInput>
        </Field>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-slate-900">Passage text</h3>
        <div className="grid grid-cols-2 gap-3">
          <Field label="English">
            <RichTextEditor value={values.textEn} onChange={(v) => onChange({ ...values, textEn: v })} />
          </Field>
          <Field label="Hindi">
            <RichTextEditor value={values.textHi} onChange={(v) => onChange({ ...values, textHi: v })} />
          </Field>
        </div>
        {!contentValid && <p className="mt-2 text-xs text-amber-600">Passage needs content in at least one language.</p>}
      </div>
    </div>
  )
}
