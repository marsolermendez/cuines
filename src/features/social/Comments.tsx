import { useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import Avatar from '../../components/Avatar'
import { btnPrimary, btnSecondary, inputCls } from '../../components/ui'
import { formatWhen } from '../../lib/dates'
import { commentSchema, reportReasonSchema } from '../../lib/schemas'
import { supabase } from '../../lib/supabase'
import { useMe } from '../auth/profiles'
import { useComments } from '../diary/queries'

/**
 * Comentarios de una entrada. Borra quien lo escribió o la autora de la entrada (la base de datos lo hace cumplir);
 * cualquiera puede reportar un comentario ajeno, y la revisión se hace desde el panel de Supabase.
 */
export default function Comments({ entryId, entryAuthorId }: { entryId: string; entryAuthorId: string }) {
  const me = useMe()
  const queryClient = useQueryClient()
  const { data: comments, isPending, isError } = useComments(entryId)
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reporting, setReporting] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  const [notice, setNotice] = useState<string | null>(null)

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['diary'] })

  async function send(e: FormEvent) {
    e.preventDefault()
    const parsed = commentSchema.safeParse(body)
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? 'Revisa el comentario')
    setSending(true)
    setError(null)
    const { error } = await supabase.from('comments').insert({ entry_id: entryId, author_id: me.id, body: parsed.data })
    setSending(false)
    if (error) return setError('No se pudo publicar el comentario. Inténtalo de nuevo.')
    setBody('')
    await refresh()
  }

  async function remove(id: string) {
    if (!window.confirm('¿Borrar este comentario?')) return
    const { error } = await supabase.from('comments').delete().eq('id', id)
    if (error) setError('No se pudo borrar el comentario.')
    else await refresh()
  }

  async function report(e: FormEvent, commentId: string) {
    e.preventDefault()
    const parsed = reportReasonSchema.safeParse(reason)
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? 'Cuéntanos el motivo')
    setError(null)
    const { error } = await supabase.from('reports').insert({ reporter_id: me.id, comment_id: commentId, reason: parsed.data })
    // 23505: ya lo habías reportado. Para quien reporta es lo mismo que haberlo conseguido.
    if (error && error.code !== '23505') return setError('No se pudo enviar el reporte. Inténtalo de nuevo.')
    setReporting(null)
    setReason('')
    setNotice('Gracias, lo revisaremos.')
  }

  return (
    <section className="mt-10" aria-labelledby="comentarios">
      <h3 id="comentarios" className="font-serif text-xl font-medium">
        Comentarios{comments && comments.length > 0 ? ` (${comments.length})` : ''}
      </h3>

      {isPending && <p className="mt-3 text-sm text-ink-soft">Cargando…</p>}
      {isError && <p className="mt-3 text-sm">No se pudieron cargar los comentarios.</p>}
      {comments?.length === 0 && <p className="mt-3 text-sm text-ink-soft">Todavía no hay comentarios. Sé la primera persona en escribir uno.</p>}

      <ul className="mt-4 grid gap-4">
        {comments?.map((c) => (
          <li key={c.id} className="flex gap-3">
            {c.profiles && <Avatar profile={c.profiles} className="size-8" />}
            <div className="min-w-0 flex-1">
              <p className="text-sm">
                <Link to={`/u/${c.profiles?.username}`} className="font-medium hover:underline">
                  {c.profiles?.display_name}
                </Link>
                <span className="ml-2 text-xs text-ink-soft">{formatWhen(c.created_at)}</span>
              </p>
              <p className="mt-0.5 whitespace-pre-line break-words">{c.body}</p>
              <div className="mt-1 flex gap-3 text-xs text-ink-soft">
                {(c.author_id === me.id || entryAuthorId === me.id) && (
                  <button className="hover:text-ink hover:underline" onClick={() => remove(c.id)}>
                    Borrar
                  </button>
                )}
                {c.author_id !== me.id && (
                  <button className="hover:text-ink hover:underline" onClick={() => { setReporting(reporting === c.id ? null : c.id); setError(null); setNotice(null) }}>
                    Reportar
                  </button>
                )}
              </div>
              {reporting === c.id && (
                <form onSubmit={(e) => report(e, c.id)} className="mt-2 flex flex-wrap gap-2">
                  <input className={`${inputCls} min-w-0 flex-1 basis-48`} aria-label="Motivo del reporte" placeholder="¿Qué problema tiene?" maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} />
                  <button className={btnPrimary}>Enviar</button>
                  <button type="button" className={btnSecondary} onClick={() => setReporting(null)}>
                    Cancelar
                  </button>
                </form>
              )}
            </div>
          </li>
        ))}
      </ul>

      {notice && (
        <p role="status" className="mt-3 text-sm text-ink-soft">
          {notice}
        </p>
      )}

      <form onSubmit={send} className="mt-5 grid gap-2">
        <textarea className={inputCls} rows={2} aria-label="Escribe un comentario" placeholder="Escribe un comentario…" maxLength={1000} value={body} onChange={(e) => setBody(e.target.value)} />
        <div className="flex items-center gap-3">
          <button className={btnPrimary} disabled={sending}>
            {sending ? 'Enviando…' : 'Comentar'}
          </button>
          {error && (
            <p role="alert" className="text-sm text-clay">
              {error}
            </p>
          )}
        </div>
      </form>
    </section>
  )
}
