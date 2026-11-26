import { useState, type FormEvent } from 'react'
import { btnPrimary, inputCls } from '../../components/ui'
import { profileFormSchema, usernameSchema } from '../../lib/schemas'
import { useMe, useUpdateProfile } from './profiles'

/** Primer login: elegir username y completar el perfil. Al guardar, RequireAuth deja pasar a la app. */
export default function OnboardingPage() {
  const me = useMe()
  const update = useUpdateProfile()
  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState(me.display_name)
  const [bio, setBio] = useState(me.bio)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    const u = usernameSchema.safeParse(username)
    const p = profileFormSchema.safeParse({ display_name: displayName, bio })
    if (!u.success) return setError(u.error.issues[0]?.message ?? 'Username no válido')
    if (!p.success) return setError(p.error.issues[0]?.message ?? 'Revisa los datos')
    setError(null)
    try {
      await update.mutateAsync({ username: u.data, ...p.data })
    } catch (err) {
      const code = (err as { code?: string }).code
      setError(code === '23505' ? 'Ese nombre de usuario ya está cogido.' : 'No se pudo guardar. Inténtalo de nuevo.')
    }
  }

  return (
    <main className="mx-auto grid min-h-screen max-w-md content-center px-6">
      <h1 className="font-serif text-3xl font-medium">Bienvenida a Cuines</h1>
      <p className="mt-2 text-ink-soft">Elige cómo te van a encontrar. El nombre de usuario no se puede cambiar después.</p>
      <form onSubmit={submit} className="mt-6 grid gap-4">
        <label className="grid gap-1 text-sm">
          Nombre de usuario
          <input
            className={inputCls}
            value={username}
            onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
            maxLength={20}
            placeholder="laia_cocina"
            autoComplete="off"
            autoFocus
          />
        </label>
        <label className="grid gap-1 text-sm">
          Nombre
          <input className={inputCls} value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={60} />
        </label>
        <label className="grid gap-1 text-sm">
          Bio <span className="text-ink-soft">(opcional)</span>
          <textarea className={inputCls} rows={3} value={bio} onChange={(e) => setBio(e.target.value)} maxLength={280} />
        </label>
        {error && (
          <p role="alert" className="text-sm text-clay">
            {error}
          </p>
        )}
        <button className={btnPrimary} disabled={update.isPending}>
          Empezar
        </button>
      </form>
    </main>
  )
}
