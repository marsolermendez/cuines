import { useState, type ChangeEvent, type FormEvent } from 'react'
import Avatar from '../../components/Avatar'
import { btnPrimary, btnSecondary, inputCls } from '../../components/ui'
import { resizeToJpeg } from '../../lib/images'
import { profileFormSchema } from '../../lib/schemas'
import { supabase } from '../../lib/supabase'
import { useMe, useUpdateProfile } from './profiles'

export default function SettingsPage() {
  const me = useMe()
  const update = useUpdateProfile()
  const [displayName, setDisplayName] = useState(me.display_name)
  const [bio, setBio] = useState(me.bio)
  const [isPrivate, setIsPrivate] = useState(me.is_private)
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null)
  const [uploading, setUploading] = useState(false)

  async function save(e: FormEvent) {
    e.preventDefault()
    const p = profileFormSchema.safeParse({ display_name: displayName, bio })
    if (!p.success) return setStatus({ ok: false, text: p.error.issues[0]?.message ?? 'Revisa los datos' })
    try {
      await update.mutateAsync({ ...p.data, is_private: isPrivate })
      setStatus({ ok: true, text: 'Guardado' })
    } catch {
      setStatus({ ok: false, text: 'No se pudo guardar. Inténtalo de nuevo.' })
    }
  }

  async function changeAvatar(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setUploading(true)
    setStatus(null)
    try {
      const { blob } = await resizeToJpeg(file, { maxSide: 256, square: true })
      const path = `${me.id}/avatar.jpg`
      const { error } = await supabase.storage.from('avatars').upload(path, blob, { upsert: true, contentType: 'image/jpeg' })
      if (error) throw error
      const { data } = supabase.storage.from('avatars').getPublicUrl(path)
      // ?v= evita que el navegador enseñe la foto anterior desde caché.
      await update.mutateAsync({ avatar_url: `${data.publicUrl}?v=${Date.now()}` })
      setStatus({ ok: true, text: 'Foto actualizada' })
    } catch {
      setStatus({ ok: false, text: 'No se pudo subir la foto. Prueba con un JPG o PNG.' })
    } finally {
      setUploading(false)
    }
  }

  return (
    <div>
      <h2 className="font-serif text-2xl font-medium">Ajustes</h2>
      <form onSubmit={save} className="mt-6 grid max-w-md gap-4">
        <div className="flex items-center gap-4">
          <Avatar profile={me} className="size-16" />
          <label className={`${btnSecondary} cursor-pointer`}>
            {uploading ? 'Subiendo…' : 'Cambiar foto'}
            <input type="file" accept="image/*" className="sr-only" onChange={changeAvatar} disabled={uploading} />
          </label>
        </div>
        <p className="text-sm text-ink-soft">@{me.username}</p>
        <label className="grid gap-1 text-sm">
          Nombre
          <input className={inputCls} value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={60} />
        </label>
        <label className="grid gap-1 text-sm">
          Bio
          <textarea className={inputCls} rows={3} value={bio} onChange={(e) => setBio(e.target.value)} maxLength={280} />
        </label>
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" className="mt-1" checked={isPrivate} onChange={(e) => setIsPrivate(e.target.checked)} />
          <span>
            Diario privado
            <span className="block text-ink-soft">Quien quiera seguirte necesitará tu aprobación.</span>
          </span>
        </label>
        <div className="flex items-center gap-3">
          <button className={btnPrimary} disabled={update.isPending}>
            Guardar
          </button>
          {status && (
            <p role="status" className={`text-sm ${status.ok ? 'text-ink-soft' : 'text-clay'}`}>
              {status.text}
            </p>
          )}
        </div>
      </form>
      <button className={`${btnSecondary} mt-10`} onClick={() => supabase.auth.signOut()}>
        Cerrar sesión
      </button>
    </div>
  )
}
