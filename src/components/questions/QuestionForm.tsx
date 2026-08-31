import { useState } from 'react'
import type { Exam } from '../../lib/api/exams'
import type { Passage } from '../../lib/api/passages'
import type { Subject } from '../../lib/api/subjects'
import type { Topic } from '../../lib/api/topics'
import type { Subtopic } from '../../lib/api/subtopics'
import type { ConceptTag } from '../../lib/api/conceptTags'
import type { Difficulty, OptionValue, PyqShift, PyqTier, Question, QuestionOption, QuestionType } from '../../lib/api/questions'
import { checkBilingualComplete, isPassageValid } from '../../lib/richtext/bilingualValidation'
import { RichTextEditor } from '../richtext/RichTextEditor'
import { Field, MultiSelectList, SelectInput, TextInput } from '../fields'

const TIERS: PyqTier[] = ['Tier 1', 'Tier 2', 'Tier 3', 'Tier 4']
const SHIFTS: PyqShift[] = ['Shift 1', 'Shift 2', 'Shift 3', 'Shift 4']
const YEARS = Array.from({ length: 2027 - 2000 + 1 }, (_, i) => 2027 - i)

function emptyOption(): QuestionOption {
  return { en: { type: 'text', value: '' }, hi: { type: 'text', value: '' } }
}

export interface QuestionFormValues {
  subject_id: string
  topic_id: string
  subtopic_id: string
  concept_tag_id: string
  textEn: string
  textHi: string
  options: QuestionOption[]
  correct_index: number
  explanationEn: string
  explanationHi: string
  // Passages are now their own entity (migration 20260126000001) — 'existing' attaches this
  // question to a passage already used elsewhere (editing passageEn/passageHi here edits that
  // SHARED passage's actual content, propagating to every other question attached to it, which
  // is the whole point: author once, attach many, instead of copy-pasting text per question).
  // 'new' creates a brand-new passage on save. passageEn/passageHi hold the editable content for
  // both cases — for 'existing' they start pre-filled with the selected passage's current text.
  passageMode: 'none' | 'existing' | 'new'
  passageId: string
  passageEn: string
  passageHi: string
  type: QuestionType
  difficulty: Difficulty
  positive_marks: string
  negative_marks: string
  status: 'Draft' | 'Published'
  exam_id: string
  pyq_year: string
  pyq_tier: string
  pyq_shift: string
  pyq_date: string
  practiceExamIds: string[]
}

export function initialFormValues(
  question: Question | null,
  defaults: { subjectId: string },
  passages: Passage[],
): QuestionFormValues {
  if (!question) {
    return {
      subject_id: defaults.subjectId,
      topic_id: '',
      subtopic_id: '',
      concept_tag_id: '',
      textEn: '',
      textHi: '',
      options: [emptyOption(), emptyOption(), emptyOption(), emptyOption()],
      correct_index: 0,
      explanationEn: '',
      explanationHi: '',
      passageMode: 'none',
      passageId: '',
      passageEn: '',
      passageHi: '',
      type: 'Practice',
      difficulty: 'easy',
      positive_marks: '1',
      negative_marks: '0',
      status: 'Draft',
      exam_id: '',
      pyq_year: '',
      pyq_tier: '',
      pyq_shift: '',
      pyq_date: '',
      practiceExamIds: [],
    }
  }
  const attachedPassage = question.passage_id ? passages.find((p) => p.id === question.passage_id) ?? null : null
  return {
    subject_id: question.subject_id,
    topic_id: question.topic_id,
    subtopic_id: question.subtopic_id ?? '',
    concept_tag_id: question.concept_tag_id ?? '',
    textEn: question.text.en?.value ?? '',
    textHi: question.text.hi?.value ?? '',
    options: question.options,
    correct_index: question.correct_index,
    explanationEn: question.explanation?.en?.value ?? '',
    explanationHi: question.explanation?.hi?.value ?? '',
    passageMode: attachedPassage ? 'existing' : 'none',
    passageId: attachedPassage?.id ?? '',
    passageEn: attachedPassage?.text.en?.value ?? '',
    passageHi: attachedPassage?.text.hi?.value ?? '',
    type: question.type,
    difficulty: question.difficulty,
    positive_marks: String(question.positive_marks),
    negative_marks: String(question.negative_marks),
    status: question.status,
    exam_id: question.exam_id ?? '',
    pyq_year: question.pyq_year ? String(question.pyq_year) : '',
    pyq_tier: question.pyq_tier ?? '',
    pyq_shift: question.pyq_shift ?? '',
    pyq_date: question.pyq_date ?? '',
    practiceExamIds: [],
  }
}

/** Converts form state into the exact payload shape admin-questions' Edge Function expects.
 * `resolvedPassageId` is the passage row's real id — for passageMode 'new', the caller must
 * create that passage first (via toPassageFields + passagesApi.create) and pass the result here,
 * since this function stays pure/synchronous and can't make that API call itself. */
export function toQuestionFields(values: QuestionFormValues, resolvedPassageId: string | null) {
  const isPyq = values.type === 'PYQ'
  return {
    subject_id: values.subject_id,
    topic_id: values.topic_id,
    subtopic_id: values.subtopic_id || null,
    concept_tag_id: values.concept_tag_id || null,
    text: {
      en: values.textEn ? { type: 'text', value: values.textEn } : undefined,
      hi: values.textHi ? { type: 'text', value: values.textHi } : undefined,
    },
    options: values.options,
    correct_index: values.correct_index,
    explanation:
      values.explanationEn || values.explanationHi
        ? {
            en: values.explanationEn ? { type: 'text', value: values.explanationEn } : undefined,
            hi: values.explanationHi ? { type: 'text', value: values.explanationHi } : undefined,
          }
        : null,
    passage_id: values.passageMode === 'none' ? null : resolvedPassageId,
    type: values.type,
    difficulty: values.difficulty,
    positive_marks: Number(values.positive_marks),
    negative_marks: Number(values.negative_marks),
    status: values.status,
    exam_id: isPyq ? values.exam_id || null : null,
    pyq_year: isPyq ? Number(values.pyq_year) : null,
    pyq_tier: isPyq ? values.pyq_tier || null : null,
    pyq_shift: isPyq ? values.pyq_shift || null : null,
    pyq_date: isPyq ? values.pyq_date || null : null,
  }
}

/** Passage row payload for passagesApi.create/update — used for BOTH passageMode 'new' (create
 * a brand-new passage) and 'existing' (save edits back to the shared passage, propagating to
 * every other question already attached to it). Passage hierarchy always mirrors the question's
 * own subject/topic/subtopic — a passage never belongs to a different topic than the questions
 * authored against it. */
export function toPassageFields(values: QuestionFormValues) {
  return {
    subject_id: values.subject_id,
    topic_id: values.topic_id,
    subtopic_id: values.subtopic_id || null,
    text: {
      en: values.passageEn ? { type: 'text' as const, value: values.passageEn } : undefined,
      hi: values.passageHi ? { type: 'text' as const, value: values.passageHi } : undefined,
    },
  }
}

interface QuestionFormProps {
  values: QuestionFormValues
  onChange: (values: QuestionFormValues) => void
  subjects: Subject[]
  topics: Topic[]
  subtopics: Subtopic[]
  conceptTags: ConceptTag[]
  exams: Exam[]
  passages: Passage[]
}

export function QuestionForm({ values, onChange, subjects, topics, subtopics, conceptTags, exams, passages }: QuestionFormProps) {
  const [optionLangTab, setOptionLangTab] = useState<'en' | 'hi'>('en')

  function set<K extends keyof QuestionFormValues>(key: K, value: QuestionFormValues[K]) {
    onChange({ ...values, [key]: value })
  }

  function setOption(index: number, lang: 'en' | 'hi', patch: Partial<OptionValue>) {
    const next = values.options.map((opt, i) =>
      i === index ? { ...opt, [lang]: { type: 'text', value: '', ...opt[lang], ...patch } } : opt,
    )
    onChange({ ...values, options: next })
  }

  const topicsForSubject = topics.filter((t) => t.subject_id === values.subject_id)
  const subtopicsForTopic = subtopics.filter((s) => s.topic_id === values.topic_id)
  const conceptTagsForTopic = conceptTags.filter(
    (c) => c.topic_id === values.topic_id && (values.subtopic_id ? c.subtopic_id === values.subtopic_id || !c.subtopic_id : true),
  )
  const passagesForTopic = passages.filter((p) => p.topic_id === values.topic_id)

  const bilingual = checkBilingualComplete(values.textEn, values.textHi, values.options)
  const passageValid = isPassageValid(values.passageEn, values.passageHi)

  function passagePreview(p: Passage): string {
    const raw = p.text.en?.value || p.text.hi?.value || ''
    return raw.length > 60 ? `${raw.slice(0, 60)}…` : raw || '(no text)'
  }

  function selectExistingPassage(passageId: string) {
    const passage = passages.find((p) => p.id === passageId)
    if (!passage) return
    onChange({
      ...values,
      passageMode: 'existing',
      passageId,
      passageEn: passage.text.en?.value ?? '',
      passageHi: passage.text.hi?.value ?? '',
    })
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Hierarchy */}
      <div className="grid grid-cols-3 gap-3">
        <Field label="Subject">
          <SelectInput
            value={values.subject_id}
            onChange={(e) => onChange({ ...values, subject_id: e.target.value, topic_id: '', subtopic_id: '', concept_tag_id: '' })}
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
            onChange={(e) => onChange({ ...values, topic_id: e.target.value, subtopic_id: '', concept_tag_id: '' })}
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
          <SelectInput value={values.subtopic_id} onChange={(e) => set('subtopic_id', e.target.value)} disabled={!values.topic_id}>
            <option value="">None</option>
            {subtopicsForTopic.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </SelectInput>
        </Field>
      </div>

      <Field label="Concept tag" hint="Optional">
        <SelectInput value={values.concept_tag_id} onChange={(e) => set('concept_tag_id', e.target.value)} disabled={!values.topic_id}>
          <option value="">None</option>
          {conceptTagsForTopic.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </SelectInput>
      </Field>

      {/* Bilingual question text */}
      <div>
        <h3 className="mb-2 text-sm font-semibold text-slate-900">Question text</h3>
        <p className={`mb-2 text-xs ${bilingual.valid ? 'text-emerald-600' : 'text-amber-600'}`}>
          {bilingual.valid
            ? `Complete in ${[bilingual.enComplete && 'English', bilingual.hiComplete && 'Hindi'].filter(Boolean).join(' and ')}.`
            : 'At least one language needs complete text + all 4 options — neither language is specifically required.'}
        </p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="English" hint={bilingual.enComplete ? undefined : 'Incomplete'}>
            <RichTextEditor value={values.textEn} onChange={(v) => set('textEn', v)} allowTables />
          </Field>
          <Field label="Hindi" hint={bilingual.hiComplete ? undefined : 'Incomplete'}>
            <RichTextEditor value={values.textHi} onChange={(v) => set('textHi', v)} allowTables />
          </Field>
        </div>
      </div>

      {/* Passage (Comprehension / Cloze Test) — a shared entity, not per-question text (admin
          doc §10 update): attach an existing passage (editing its text here saves back to that
          SAME shared row, propagating to every other question already attached to it) or
          author a brand-new one. No question-number range in the label/placeholder — a
          passage's position within any given quiz is computed at render time, not baked into
          the authored content (mobile's RichText/quizEngine.ts). */}
      <div>
        <Field label="Passage">
          <div className="flex gap-4 pt-2">
            {(['none', 'existing', 'new'] as const).map((mode) => (
              <label key={mode} className="flex items-center gap-1.5 text-sm text-slate-700">
                <input
                  type="radio"
                  name="passageMode"
                  checked={values.passageMode === mode}
                  onChange={() => {
                    if (mode === 'existing') {
                      const first = passagesForTopic[0]
                      onChange({
                        ...values,
                        passageMode: mode,
                        passageId: first?.id ?? '',
                        passageEn: first?.text.en?.value ?? '',
                        passageHi: first?.text.hi?.value ?? '',
                      })
                    } else {
                      onChange({ ...values, passageMode: mode, passageId: '', passageEn: '', passageHi: '' })
                    }
                  }}
                />
                {mode === 'none' ? 'No passage' : mode === 'existing' ? 'Attach existing' : 'Create new'}
              </label>
            ))}
          </div>
        </Field>

        {values.passageMode === 'existing' && (
          <div className="mt-3">
            <Field
              label="Existing passage"
              hint={passagesForTopic.length === 0 ? 'No passages exist yet for this topic — switch to "Create new".' : undefined}
            >
              <SelectInput value={values.passageId} onChange={(e) => selectExistingPassage(e.target.value)} disabled={passagesForTopic.length === 0}>
                {passagesForTopic.map((p) => (
                  <option key={p.id} value={p.id}>
                    {passagePreview(p)}
                  </option>
                ))}
              </SelectInput>
            </Field>
          </div>
        )}

        {(values.passageMode === 'existing' || values.passageMode === 'new') && (
          <div className="mt-3 grid grid-cols-2 gap-3">
            {values.passageMode === 'existing' && (
              <p className="col-span-2 text-xs text-amber-600">
                Editing this text updates the shared passage for every question attached to it, not just this one.
              </p>
            )}
            <Field label="Passage — English">
              <RichTextEditor value={values.passageEn} onChange={(v) => set('passageEn', v)} />
            </Field>
            <Field label="Passage — Hindi">
              <RichTextEditor value={values.passageHi} onChange={(v) => set('passageHi', v)} />
            </Field>
            {!passageValid && <p className="col-span-2 text-xs text-amber-600">Passage needs content in at least one language.</p>}
          </div>
        )}
      </div>

      {/* Options */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900">Options — mark the correct one</h3>
          <div className="flex gap-1 rounded-md bg-slate-100 p-0.5 text-xs font-medium">
            {(['en', 'hi'] as const).map((lang) => (
              <button
                key={lang}
                type="button"
                onClick={() => setOptionLangTab(lang)}
                className={`rounded px-2.5 py-1 ${optionLangTab === lang ? 'bg-white shadow-sm' : 'text-slate-500'}`}
              >
                {lang === 'en' ? 'English' : 'Hindi'}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-2.5">
          {values.options.map((option, index) => {
            const optionValue = option[optionLangTab] ?? { type: 'text', value: '' }
            return (
              <div key={index} className="flex items-center gap-3 rounded-md border border-slate-200 p-2.5">
                <input
                  type="radio"
                  name="correct_index"
                  checked={values.correct_index === index}
                  onChange={() => set('correct_index', index)}
                  title="Correct answer"
                  className="h-4 w-4"
                />
                <span className="w-5 text-sm font-medium text-slate-400">{String.fromCharCode(65 + index)}</span>
                <div className="flex flex-1 items-center gap-2">
                  {optionValue.type === 'text' ? (
                    <TextInput
                      className="flex-1"
                      placeholder={`Option ${String.fromCharCode(65 + index)} (${optionLangTab.toUpperCase()})`}
                      value={optionValue.value}
                      onChange={(e) => setOption(index, optionLangTab, { value: e.target.value })}
                    />
                  ) : (
                    <TextInput
                      className="flex-1"
                      placeholder="Image URL (upload via the question text editor's image button, then paste the URL here)"
                      value={optionValue.value}
                      onChange={(e) => setOption(index, optionLangTab, { value: e.target.value })}
                    />
                  )}
                  <SelectInput
                    className="w-28"
                    value={optionValue.type}
                    onChange={(e) => setOption(index, optionLangTab, { type: e.target.value as 'text' | 'image' })}
                  >
                    <option value="text">Text</option>
                    <option value="image">Image</option>
                  </SelectInput>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Explanation */}
      <div>
        <h3 className="mb-2 text-sm font-semibold text-slate-900">Explanation</h3>
        <p className="mb-2 text-xs text-slate-400">Optional — can be left blank entirely.</p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="English">
            <RichTextEditor value={values.explanationEn} onChange={(v) => set('explanationEn', v)} />
          </Field>
          <Field label="Hindi">
            <RichTextEditor value={values.explanationHi} onChange={(v) => set('explanationHi', v)} />
          </Field>
        </div>
      </div>

      {/* Type + PYQ/Practice conditional fields */}
      <div className="rounded-md border border-slate-200 p-4">
        <Field label="Type">
          <div className="flex gap-4">
            {(['Practice', 'PYQ'] as QuestionType[]).map((t) => (
              <label key={t} className="flex items-center gap-1.5 text-sm text-slate-700">
                <input type="radio" name="type" checked={values.type === t} onChange={() => set('type', t)} />
                {t}
              </label>
            ))}
          </div>
        </Field>

        {values.type === 'PYQ' ? (
          <div className="mt-3 grid grid-cols-4 gap-3">
            <Field label="Exam">
              <SelectInput value={values.exam_id} onChange={(e) => set('exam_id', e.target.value)}>
                <option value="">Select…</option>
                {exams.map((ex) => (
                  <option key={ex.id} value={ex.id}>
                    {ex.name}
                  </option>
                ))}
              </SelectInput>
            </Field>
            <Field label="Year">
              <SelectInput value={values.pyq_year} onChange={(e) => set('pyq_year', e.target.value)}>
                <option value="">Select…</option>
                {YEARS.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </SelectInput>
            </Field>
            <Field label="Tier">
              <SelectInput value={values.pyq_tier} onChange={(e) => set('pyq_tier', e.target.value)}>
                <option value="">Select…</option>
                {TIERS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </SelectInput>
            </Field>
            <Field label="Shift">
              <SelectInput value={values.pyq_shift} onChange={(e) => set('pyq_shift', e.target.value)}>
                <option value="">Select…</option>
                {SHIFTS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </SelectInput>
            </Field>
            <Field label="Exact date">
              <TextInput type="date" value={values.pyq_date} onChange={(e) => set('pyq_date', e.target.value)} />
            </Field>
          </div>
        ) : (
          <div className="mt-3">
            <Field label="Tag with exam(s)" hint="Optional — lets a hand-curated Practice set behave like an exam-specific quiz.">
              <MultiSelectList
                options={exams.map((ex) => ({ id: ex.id, label: ex.name }))}
                selected={values.practiceExamIds}
                onChange={(ids) => set('practiceExamIds', ids)}
              />
            </Field>
          </div>
        )}
      </div>

      {/* Difficulty, marks, status */}
      <div className="grid grid-cols-4 gap-3">
        <Field label="Difficulty">
          <SelectInput value={values.difficulty} onChange={(e) => set('difficulty', e.target.value as Difficulty)}>
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </SelectInput>
        </Field>
        <Field label="Positive marks">
          <TextInput type="number" step="0.01" value={values.positive_marks} onChange={(e) => set('positive_marks', e.target.value)} />
        </Field>
        <Field label="Negative marks">
          <TextInput type="number" step="0.01" value={values.negative_marks} onChange={(e) => set('negative_marks', e.target.value)} />
        </Field>
        <Field label="Status">
          <SelectInput value={values.status} onChange={(e) => set('status', e.target.value as 'Draft' | 'Published')}>
            <option value="Draft">Draft</option>
            <option value="Published">Published</option>
          </SelectInput>
        </Field>
      </div>
    </div>
  )
}
