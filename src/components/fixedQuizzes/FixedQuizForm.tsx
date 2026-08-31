import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowDown, ArrowUp, X } from 'lucide-react'
import type { Exam } from '../../lib/api/exams'
import type { Subject } from '../../lib/api/subjects'
import type { Topic } from '../../lib/api/topics'
import { type FixedQuiz, type QuizScope } from '../../lib/api/fixedQuizzes'
import { questionsApi, type PyqShift, type PyqTier, type Question, type QuestionType } from '../../lib/api/questions'
import { Field, SelectInput, TextInput, Toggle } from '../fields'

const TIERS: PyqTier[] = ['Tier 1', 'Tier 2', 'Tier 3', 'Tier 4']
const SHIFTS: PyqShift[] = ['Shift 1', 'Shift 2', 'Shift 3', 'Shift 4']
const YEARS = Array.from({ length: 2027 - 2000 + 1 }, (_, i) => 2027 - i)

export interface FixedQuizFormValues {
  title: string
  quiz_type: QuestionType
  scope: QuizScope
  topic_id: string
  subject_id: string
  exam_id: string
  pyq_year: string
  pyq_tier: string
  pyq_shift: string
  pyq_date: string
  time_limit_minutes: string
  locked: boolean
  status: 'Draft' | 'Published'
}

export function initialFixedQuizValues(quiz: FixedQuiz | null): FixedQuizFormValues {
  if (!quiz) {
    return {
      title: '',
      quiz_type: 'PYQ',
      scope: 'topic',
      topic_id: '',
      subject_id: '',
      exam_id: '',
      pyq_year: '',
      pyq_tier: '',
      pyq_shift: '',
      pyq_date: '',
      time_limit_minutes: '',
      // Defaults to locked/Pro on every new quiz (admin doc §3) — admin explicitly unlocks.
      locked: true,
      status: 'Draft',
    }
  }
  return {
    title: quiz.title,
    quiz_type: quiz.quiz_type,
    scope: quiz.scope,
    topic_id: quiz.topic_id ?? '',
    subject_id: quiz.subject_id ?? '',
    exam_id: quiz.exam_id ?? '',
    pyq_year: quiz.pyq_year ? String(quiz.pyq_year) : '',
    pyq_tier: quiz.pyq_tier ?? '',
    pyq_shift: quiz.pyq_shift ?? '',
    pyq_date: quiz.pyq_date ?? '',
    time_limit_minutes: quiz.time_limit_minutes ? String(quiz.time_limit_minutes) : '',
    locked: quiz.locked,
    status: quiz.status,
  }
}

export function toFixedQuizFields(values: FixedQuizFormValues) {
  const isPyq = values.quiz_type === 'PYQ'
  const isSubjectScope = values.scope === 'subject'
  return {
    title: values.title,
    quiz_type: values.quiz_type,
    scope: values.scope,
    topic_id: values.scope === 'topic' ? values.topic_id : null,
    subject_id: isSubjectScope ? values.subject_id : null,
    exam_id: isPyq ? values.exam_id || null : values.exam_id || null,
    pyq_year: isPyq ? Number(values.pyq_year) : null,
    pyq_tier: isPyq ? values.pyq_tier || null : null,
    pyq_shift: isPyq ? values.pyq_shift || null : null,
    // topic-scope PYQ pools across dates (no exact date) — subject-scope PYQ may optionally
    // pin one (admin doc §3).
    pyq_date: isPyq && isSubjectScope ? values.pyq_date || null : null,
    time_limit_minutes: values.time_limit_minutes ? Number(values.time_limit_minutes) : null,
    locked: values.locked,
    status: values.status,
  }
}

interface FixedQuizFormProps {
  values: FixedQuizFormValues
  onChange: (values: FixedQuizFormValues) => void
  subjects: Subject[]
  topics: Topic[]
  exams: Exam[]
  questionIds: string[]
  onQuestionIdsChange: (ids: string[]) => void
}

export function FixedQuizForm({ values, onChange, subjects, topics, exams, questionIds, onQuestionIdsChange }: FixedQuizFormProps) {
  function set<K extends keyof FixedQuizFormValues>(key: K, value: FixedQuizFormValues[K]) {
    onChange({ ...values, [key]: value })
  }

  const isPyq = values.quiz_type === 'PYQ'
  const isSubjectScope = values.scope === 'subject'

  // Eligible pool mirrors admin doc §3's scope rules — Published/Active/non-Archived only, and
  // for PYQ, the same exam/year/tier/shift(/date) this quiz itself is scoped to.
  const poolFilters = {
    topicId: values.scope === 'topic' ? values.topic_id || undefined : undefined,
    subjectId: isSubjectScope ? values.subject_id || undefined : undefined,
    type: values.quiz_type,
    status: 'Published' as const,
    active: true,
    examId: isPyq ? values.exam_id || undefined : undefined,
    pyqYear: isPyq && values.pyq_year ? Number(values.pyq_year) : undefined,
    pyqTier: isPyq ? values.pyq_tier || undefined : undefined,
    pyqShift: isPyq ? values.pyq_shift || undefined : undefined,
    pyqDate: isPyq && isSubjectScope ? values.pyq_date || undefined : undefined,
  }
  const poolReady = values.scope === 'topic' ? Boolean(values.topic_id) : Boolean(values.subject_id)

  const poolQuery = useQuery({
    queryKey: ['questionPool', poolFilters],
    queryFn: () => questionsApi.list(false, poolFilters, 0, 100),
    enabled: poolReady,
  })
  const selectedQuery = useQuery({
    queryKey: ['questionsByIds', questionIds],
    queryFn: () => questionsApi.list(false, {}, 0, 500),
    enabled: false,
  })

  const [selectedQuestions, setSelectedQuestions] = useState<Question[]>([])

  // Keep a lookup of full Question objects for whatever's currently selected — merges anything
  // newly added from the pool with what was already resolved (e.g. loaded via getQuestionIds on
  // edit) rather than re-fetching everything on every add/remove.
  function addQuestion(question: Question) {
    if (questionIds.includes(question.id)) return
    onQuestionIdsChange([...questionIds, question.id])
    setSelectedQuestions((prev) => [...prev, question])
  }
  function removeQuestion(id: string) {
    onQuestionIdsChange(questionIds.filter((qid) => qid !== id))
    setSelectedQuestions((prev) => prev.filter((q) => q.id !== id))
  }
  function move(index: number, direction: -1 | 1) {
    const next = [...questionIds]
    const target = index + direction
    if (target < 0 || target >= next.length) return
    ;[next[index], next[target]] = [next[target], next[index]]
    onQuestionIdsChange(next)
    setSelectedQuestions((prev) => {
      const copy = [...prev]
      ;[copy[index], copy[target]] = [copy[target], copy[index]]
      return copy
    })
  }

  // On first render with pre-existing questionIds (edit mode), resolve them to full Question
  // rows for display — a plain filter-less list fetch, capped generously (500) since a single
  // fixed quiz's question count is always small in practice.
  const needsResolve = questionIds.length > 0 && selectedQuestions.length === 0
  if (needsResolve && !selectedQuery.isFetching && selectedQuery.fetchStatus === 'idle') {
    selectedQuery.refetch().then((result) => {
      const byId = new Map((result.data?.items ?? []).map((q) => [q.id, q]))
      setSelectedQuestions(questionIds.map((id) => byId.get(id)).filter((q): q is Question => Boolean(q)))
    })
  }

  const availableQuestions = (poolQuery.data?.items ?? []).filter((q) => !questionIds.includes(q.id))

  return (
    <div className="flex flex-col gap-6">
      <Field label="Title">
        <TextInput required value={values.title} onChange={(e) => set('title', e.target.value)} />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Type">
          <div className="flex gap-4 pt-2">
            {(['PYQ', 'Practice'] as QuestionType[]).map((t) => (
              <label key={t} className="flex items-center gap-1.5 text-sm text-slate-700">
                <input type="radio" name="quiz_type" checked={values.quiz_type === t} onChange={() => set('quiz_type', t)} />
                {t}
              </label>
            ))}
          </div>
        </Field>
        <Field label="Scope">
          <div className="flex gap-4 pt-2">
            {(['topic', 'subject'] as QuizScope[]).map((s) => (
              <label key={s} className="flex items-center gap-1.5 text-sm capitalize text-slate-700">
                <input type="radio" name="scope" checked={values.scope === s} onChange={() => set('scope', s)} />
                {s}-level
              </label>
            ))}
          </div>
        </Field>
      </div>

      {values.scope === 'topic' ? (
        <Field label="Topic">
          <SelectInput value={values.topic_id} onChange={(e) => set('topic_id', e.target.value)}>
            <option value="">Select…</option>
            {topics.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </SelectInput>
        </Field>
      ) : (
        <Field label="Subject">
          <SelectInput value={values.subject_id} onChange={(e) => set('subject_id', e.target.value)}>
            <option value="">Select…</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </SelectInput>
        </Field>
      )}

      {isPyq ? (
        <div className="grid grid-cols-4 gap-3 rounded-md border border-slate-200 p-4">
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
          {isSubjectScope && (
            <Field label="Exact date" hint="Optional — blank pools the whole subject across every date in that year/tier/shift.">
              <TextInput type="date" value={values.pyq_date} onChange={(e) => set('pyq_date', e.target.value)} />
            </Field>
          )}
          {values.scope === 'topic' && (
            <p className="col-span-4 text-xs text-slate-400">
              Topic-level PYQ pools across every date sharing this shift — no exact date field.
            </p>
          )}
        </div>
      ) : (
        <Field label="Exam" hint="Optional — tags this Practice set to behave like an exam-specific quiz (admin doc §3).">
          <SelectInput value={values.exam_id} onChange={(e) => set('exam_id', e.target.value)}>
            <option value="">None — universal</option>
            {exams.map((ex) => (
              <option key={ex.id} value={ex.id}>
                {ex.name}
              </option>
            ))}
          </SelectInput>
        </Field>
      )}

      <div className="grid grid-cols-3 gap-3">
        <Field label="Time limit (minutes)" hint="Optional">
          <TextInput
            type="number"
            value={values.time_limit_minutes}
            onChange={(e) => set('time_limit_minutes', e.target.value)}
          />
        </Field>
        <Field label="Status">
          <SelectInput value={values.status} onChange={(e) => set('status', e.target.value as 'Draft' | 'Published')}>
            <option value="Draft">Draft</option>
            <option value="Published">Published</option>
          </SelectInput>
        </Field>
        <Field label="Access">
          <div className="pt-2">
            <Toggle checked={!values.locked} onChange={(unlocked) => set('locked', !unlocked)} label={values.locked ? 'Locked (Pro)' : 'Unlocked (Free)'} />
          </div>
        </Field>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-slate-900">Questions ({questionIds.length})</h3>
        {!poolReady ? (
          <p className="text-sm text-slate-400">Pick a {values.scope} above to see eligible questions.</p>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-slate-400">
                Available ({availableQuestions.length})
              </p>
              <div className="flex max-h-72 flex-col gap-1.5 overflow-y-auto rounded-md border border-slate-200 p-2">
                {poolQuery.isPending ? (
                  <p className="p-2 text-sm text-slate-400">Loading…</p>
                ) : availableQuestions.length === 0 ? (
                  <p className="p-2 text-sm text-slate-400">No eligible questions match this scope yet.</p>
                ) : (
                  availableQuestions.map((q) => (
                    <button
                      key={q.id}
                      type="button"
                      onClick={() => addQuestion(q)}
                      className="rounded-md border border-slate-100 px-2.5 py-1.5 text-left text-sm text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                    >
                      {(q.text.en?.value || q.text.hi?.value || '(no text)').slice(0, 70)}
                    </button>
                  ))
                )}
              </div>
            </div>
            <div>
              <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-slate-400">Selected, in order</p>
              <div className="flex max-h-72 flex-col gap-1.5 overflow-y-auto rounded-md border border-slate-200 p-2">
                {selectedQuestions.length === 0 ? (
                  <p className="p-2 text-sm text-slate-400">Add questions from the left.</p>
                ) : (
                  selectedQuestions.map((q, index) => (
                    <div key={q.id} className="flex items-center gap-1.5 rounded-md border border-slate-100 px-2 py-1.5">
                      <span className="w-5 text-xs text-slate-400">{index + 1}</span>
                      <span className="flex-1 truncate text-sm text-slate-700">{(q.text.en?.value || q.text.hi?.value || '(no text)').slice(0, 60)}</span>
                      <button type="button" onClick={() => move(index, -1)} className="rounded p-1 text-slate-400 hover:bg-slate-100">
                        <ArrowUp size={13} />
                      </button>
                      <button type="button" onClick={() => move(index, 1)} className="rounded p-1 text-slate-400 hover:bg-slate-100">
                        <ArrowDown size={13} />
                      </button>
                      <button type="button" onClick={() => removeQuestion(q.id)} className="rounded p-1 text-red-400 hover:bg-red-50">
                        <X size={13} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
