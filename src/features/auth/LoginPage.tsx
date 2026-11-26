import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import Logo from '../../components/Logo'
import { btnSecondary } from '../../components/ui'
import { useSession } from './AuthProvider'
import { Splash } from './RequireAuth'

function GoogleLogo() {
  return (
    <svg viewBox="0 0 48 48" className="size-5" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  )
}

/**
 * Si el login falla, Supabase vuelve al sitio con `?error=…&error_description=…`. El caso que importa es la lista de
 * acceso (tabla allowed_emails): la cuenta de Google es válida pero su correo no tiene acceso a Cuines.
 */
function loginErrorFromUrl(): string | null {
  const params = new URLSearchParams(window.location.search)
  if (!params.has('error')) return null
  const detail = params.get('error_description') ?? ''
  return /no tiene acceso|saving new user/i.test(detail)
    ? 'Esta cuenta de Google todavía no tiene acceso a Cuines. Pide acceso a quien lo gestiona.'
    : 'No se pudo iniciar sesión con Google. Inténtalo de nuevo.'
}

export default function LoginPage() {
  const { session, loading } = useSession()
  const [error, setError] = useState<string | null>(loginErrorFromUrl)
  const [busy, setBusy] = useState(false)

  // Quita el error de la URL para que recargar no repita el aviso.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).has('error')) {
      window.history.replaceState(null, '', window.location.pathname + window.location.hash)
    }
  }, [])

  if (loading) return <Splash />
  if (session) return <Navigate to="/" replace />

  async function signIn() {
    setBusy(true)
    setError(null)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      // Vuelve a la raíz del sitio (con base /cuines/ en GitHub Pages); la ruta con # se resuelve después.
      options: { redirectTo: `${window.location.origin}${import.meta.env.BASE_URL}` },
    })
    if (error) {
      setError('No se pudo iniciar sesión con Google. Inténtalo de nuevo.')
      setBusy(false)
    }
  }

  return (
    <main className="grid min-h-screen place-items-center px-6">
      <div className="w-full max-w-sm text-center">
        <h1 className="text-4xl">
          <Logo />
        </h1>
        <p className="mt-3 text-ink-soft">Tu diario de cocina: lo que cocinas, cómo sale y con quién lo comes.</p>
        <button className={`${btnSecondary} mt-8 w-full py-3`} onClick={signIn} disabled={busy}>
          <GoogleLogo />
          Entrar con Google
        </button>
        {error && (
          <p role="alert" className="mt-3 text-sm text-clay">
            {error}
          </p>
        )}
      </div>
    </main>
  )
}
