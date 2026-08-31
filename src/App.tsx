import { Navigate, Route, BrowserRouter, Routes } from 'react-router-dom'
import { useSession } from './hooks/useSession'
import { useAdminGate } from './hooks/useAdminGate'
import { LoginPage } from './pages/LoginPage'
import { Layout } from './components/Layout'
import { ExamsPage } from './pages/ExamsPage'
import { SubjectsPage } from './pages/SubjectsPage'
import { TopicsPage } from './pages/TopicsPage'
import { SubtopicsPage } from './pages/SubtopicsPage'
import { ConceptTagsPage } from './pages/ConceptTagsPage'
import { QuestionsPage } from './pages/QuestionsPage'
import { PassagesPage } from './pages/PassagesPage'
import { FixedQuizzesPage } from './pages/FixedQuizzesPage'
import { OverviewPage } from './pages/OverviewPage'
import { QuestionReportsPage } from './pages/QuestionReportsPage'
import { UsersPage } from './pages/UsersPage'
import { supabase } from './lib/supabase'

function FullScreenMessage({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <div className="max-w-sm text-center">
        <h1 className="text-lg font-semibold text-slate-900">{title}</h1>
        <p className="mt-2 text-sm text-slate-500">{body}</p>
        <button
          onClick={() => supabase.auth.signOut()}
          className="mt-4 text-sm text-slate-500 underline underline-offset-2"
        >
          Sign out
        </button>
      </div>
    </div>
  )
}

function AuthedApp() {
  const status = useAdminGate(true)

  if (status === 'checking') {
    return <FullScreenMessage title="Checking access…" body="One moment." />
  }
  if (status === 'forbidden') {
    return (
      <FullScreenMessage
        title="Not authorized"
        body="This account isn't set up as an admin yet. Ask an existing admin to add your user_id to the admin_users table."
      />
    )
  }
  if (status === 'error') {
    return <FullScreenMessage title="Couldn't verify access" body="Check your connection and reload the page." />
  }

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<OverviewPage />} />
        <Route path="/exams" element={<ExamsPage />} />
        <Route path="/subjects" element={<SubjectsPage />} />
        <Route path="/topics" element={<TopicsPage />} />
        <Route path="/subtopics" element={<SubtopicsPage />} />
        <Route path="/concept-tags" element={<ConceptTagsPage />} />
        <Route path="/questions" element={<QuestionsPage />} />
        <Route path="/passages" element={<PassagesPage />} />
        <Route path="/fixed-quizzes" element={<FixedQuizzesPage />} />
        <Route path="/question-reports" element={<QuestionReportsPage />} />
        <Route path="/users" element={<UsersPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

function App() {
  const { session, loading } = useSession()

  if (loading) {
    return <FullScreenMessage title="Loading…" body="" />
  }
  if (!session) {
    return <LoginPage />
  }

  return (
    <BrowserRouter>
      <AuthedApp />
    </BrowserRouter>
  )
}

export default App
