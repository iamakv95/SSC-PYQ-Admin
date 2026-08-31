import type { ReactNode } from 'react'

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
      {label}
      {children}
      {hint && <span className="text-xs font-normal text-slate-400">{hint}</span>}
    </label>
  )
}

const inputClass =
  'rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-500 disabled:bg-slate-50 disabled:text-slate-400'

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${inputClass} ${props.className ?? ''}`} />
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${inputClass} ${props.className ?? ''}`} />
}

export function SelectInput(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${inputClass} bg-white ${props.className ?? ''}`} />
}

export function Toggle({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`flex items-center text-sm font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-50 ${label ? 'gap-2' : ''}`}
    >
      <span
        className={`relative inline-block h-5 w-9 shrink-0 rounded-full transition-colors ${checked ? 'bg-slate-900' : 'bg-slate-200'}`}
      >
        <span
          className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
            checked ? 'translate-x-4' : 'translate-x-0'
          }`}
        />
      </span>
      {label && <span>{label}</span>}
    </button>
  )
}

/** Simple checkbox-list multi-select — used for exam linking (Subject) and Practice
 * multi-exam tagging (Question). Deliberately not a fancy combobox: these lists are short
 * (a handful of exams), and a plain checkbox list is the least fragile UI for "pick any of these". */
export function MultiSelectList({
  options,
  selected,
  onChange,
}: {
  options: { id: string; label: string }[]
  selected: string[]
  onChange: (ids: string[]) => void
}) {
  function toggle(id: string) {
    onChange(selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id])
  }

  if (options.length === 0) {
    return <p className="text-sm text-slate-400">Nothing available yet.</p>
  }

  return (
    <div className="flex max-h-40 flex-col gap-1.5 overflow-y-auto rounded-md border border-slate-200 p-2.5">
      {options.map((option) => (
        <label key={option.id} className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={selected.includes(option.id)}
            onChange={() => toggle(option.id)}
            className="h-4 w-4 rounded border-slate-300"
          />
          {option.label}
        </label>
      ))}
    </div>
  )
}

export function Button({
  variant = 'primary',
  className = '',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' }) {
  const variants: Record<string, string> = {
    primary: 'bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50',
    secondary: 'border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-50',
    ghost: 'text-slate-500 hover:bg-slate-100 disabled:opacity-50',
  }
  return (
    <button
      {...props}
      className={`rounded-md px-3 py-1.5 text-sm font-medium ${variants[variant]} ${className}`}
    />
  )
}
