import { Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import LoginPage from './features/auth/LoginPage'
import OnboardingPage from './features/auth/OnboardingPage'
import ProfilePage from './features/auth/ProfilePage'
import RequireAuth from './features/auth/RequireAuth'
import SettingsPage from './features/auth/SettingsPage'

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
          <Route path="/" element={<Stub title="Inicio" />} />
          <Route path="/draft" element={<Stub title="Quiero cocinar" />} />
          <Route path="/new" element={<Stub title="Nueva entrada" />} />
          <Route path="/u/:username" element={<ProfilePage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Stub title="No encontrada" />} />
        </Route>
      </Route>
    </Routes>
  )
}
