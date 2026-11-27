import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import Loading from './components/Loading'
import NotFound from './components/NotFound'
import LoginPage from './features/auth/LoginPage'
import RequireAuth from './features/auth/RequireAuth'

// Cada pantalla es su propio archivo: se descarga al entrar en ella, no todo junto al abrir la web.
const OnboardingPage = lazy(() => import('./features/auth/OnboardingPage'))
const ProfilePage = lazy(() => import('./features/auth/ProfilePage'))
const SettingsPage = lazy(() => import('./features/auth/SettingsPage'))
const DraftForm = lazy(() => import('./features/diary/DraftForm'))
const DraftsPage = lazy(() => import('./features/diary/DraftsPage'))
const EntryForm = lazy(() => import('./features/diary/EntryForm'))
const EntryPage = lazy(() => import('./features/diary/EntryPage'))
const RecipePage = lazy(() => import('./features/diary/RecipePage'))
const FeedPage = lazy(() => import('./features/social/FeedPage'))
const ActivityPage = lazy(() => import('./features/social/ActivityPage'))

export default function App() {
  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<RequireAuth />}>
          <Route path="/onboarding" element={<OnboardingPage />} />
          <Route element={<Layout />}>
            <Route path="/" element={<FeedPage />} />
            <Route path="/actividad" element={<ActivityPage />} />
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
            <Route path="*" element={<NotFound />} />
          </Route>
        </Route>
      </Routes>
    </Suspense>
  )
}
