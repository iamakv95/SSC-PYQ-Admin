import { NavLink, Outlet } from 'react-router-dom'
import {
  BookMarked,
  BookOpenText,
  FileQuestion,
  Flag,
  LayoutDashboard,
  Layers,
  ListTree,
  LogOut,
  MessageSquareHeart,
  Tags,
  Trophy,
  Users,
  Workflow,
} from 'lucide-react'
import { supabase } from '../lib/supabase'

const NAV_ITEMS = [
  { to: '/', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/exams', label: 'Exams', icon: Trophy },
  { to: '/subjects', label: 'Subjects', icon: BookMarked },
  { to: '/topics', label: 'Topics', icon: Layers },
  { to: '/subtopics', label: 'Subtopics', icon: ListTree },
  { to: '/concept-tags', label: 'Concept Tags', icon: Tags },
  { to: '/questions', label: 'Question Bank', icon: FileQuestion },
  { to: '/question-reports', label: 'Question Reports', icon: Flag },
  { to: '/app-feedback', label: 'App Feedback', icon: MessageSquareHeart },
  { to: '/users', label: 'Users', icon: Users },
  { to: '/passages', label: 'Passages', icon: BookOpenText },
  { to: '/fixed-quizzes', label: 'Fixed Quizzes', icon: Workflow },
]

export function Layout() {
  return (
    <div className="flex min-h-screen bg-slate-50">
      <aside className="flex w-60 shrink-0 flex-col border-r border-slate-200 bg-white">
        <div className="px-5 py-5">
          <h1 className="text-base font-semibold text-slate-900">SSC Prep Admin</h1>
        </div>
        <nav className="flex-1 px-3">
          {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `mb-1 flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium ${
                  isActive ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
                }`
              }
            >
              <Icon size={16} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-slate-200 px-3 py-3">
          <button
            onClick={() => supabase.auth.signOut()}
            className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium text-slate-500 hover:bg-slate-100"
          >
            <LogOut size={16} />
            Sign out
          </button>
        </div>
      </aside>
      <main className="min-w-0 flex-1 px-8 py-8">
        <Outlet />
      </main>
    </div>
  )
}
