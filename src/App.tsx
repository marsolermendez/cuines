import { Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import LoginPage from './features/auth/LoginPage'
import OnboardingPage from './features/auth/OnboardingPage'
import ProfilePage from './features/auth/ProfilePage'
import RequireAuth from './features/auth/RequireAuth'
import SettingsPage from './features/auth/SettingsPage'
import DraftForm from './features/diary/DraftForm'
import DraftsPage from './features/diary/DraftsPage'
import EntryForm from './features/diary/EntryForm'
import EntryPage from './features/diary/EntryPage'
import RecipePage from './features/diary/RecipePage'
import FeedPage from './features/social/FeedPage'

function Stub({ title }: { title: string }) {
  return <h2 className="font-serif text-2xl font-medium">{title}</h2>
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<RequireAuth />}>
        <Route path="/onboarding" element={<OnboardingPage />} />
        <Route element={<Layout />}>
          <Route path="/" element={<FeedPage />} />
          <Route path="/draft" element={<DraftsPage />} />
          <Route path="/draft/new" element={<DraftForm />} />
          <Route path="/draft/:id" element={<DraftForm />} />
          <Route path="/new" element={<EntryForm />} />
          <Route path="/e/:id" element={<EntryPage />} />
          <Route path="/e/:id/edit" element={<EntryForm />} />
          <Route path="/u/:username" element={<ProfilePage view="timeline" />} />
          <Route path="/u/:username/calendario" element={<ProfilePage view="calendar" />} />
          <Route path="/u/:username/recetario" element={<ProfilePage view="recipes" />} />
          <Route path="/r/:id" element={<RecipePage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Stub title="No encontrada" />} />
        </Route>
      </Route>
    </Routes>
  )
}
