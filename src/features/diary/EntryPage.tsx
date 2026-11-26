import { useQueryClient } from '@tanstack/react-query'
import { ExternalLink } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import Avatar from '../../components/Avatar'
import ProgressiveImage from '../../components/ProgressiveImage'
import { btnSecondary } from '../../components/ui'
import { formatDay } from '../../lib/dates'
import { supabase } from '../../lib/supabase'
import { useMe } from '../auth/profiles'
import { removePhotoFiles, useSignedUrls } from './photos'
import { useEntry } from './queries'
import { visibilityInfo } from './visibility'

export default function EntryPage() {
  const { id } = useParams()
  const me = useMe()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data: entry, isPending, isError } = useEntry(id)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const photos = entry?.entry_photos ?? []
  const urls = useSignedUrls(photos.flatMap((p) => [p.path, p.thumb_path]))

  if (isPending) return <p className="text-ink-soft">Cargando…</p>
  if (isError) return <p>No se pudo cargar la entrada.</p>
  // La RLS no distingue "no existe" de "no puedes verla": para quien mira es lo mismo.
  if (!entry) return <p>Esta entrada no existe o no puedes verla.</p>

  const mine = entry.author_id === me.id
  const recipe = entry.recipes
  const author = entry.profiles
  const vis = visibilityInfo(entry.visibility)
  const [cover, ...rest] = photos

  async function remove() {
    if (!entry || !window.confirm('¿Borrar esta entrada y sus fotos? No se puede deshacer.')) return
    setDeleting(true)
    setError(null)
    try {
      const { error } = await supabase.from('entries').delete().eq('id', entry.id)
      if (error) throw error
      // Primero las filas y luego los archivos: si algo falla a medias queda un archivo huérfano que nadie lee,
      // en vez de una foto rota en el diario.
      await removePhotoFiles(photos.flatMap((p) => [p.path, p.thumb_path]))
      // La receta solo se borra si nadie más la usa (la base de datos rechaza el borrado si tiene entradas).
      if (recipe) await supabase.from('recipes').delete().eq('id', recipe.id)
      await queryClient.invalidateQueries({ queryKey: ['diary'] })
      navigate(`/u/${me.username}`, { replace: true })
    } catch {
      setError('No se pudo borrar. Inténtalo de nuevo.')
      setDeleting(false)
    }
  }

  return (
    <article>
      <p className="text-sm text-ink-soft">{entry.cooked_on && formatDay(entry.cooked_on, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
      <h2 className="mt-1 font-serif text-3xl font-medium leading-tight">{entry.title}</h2>
      <div className="mt-3 flex items-center gap-3 text-sm text-ink-soft">
        {author && (
          <Link to={`/u/${author.username}`} className="flex items-center gap-2 hover:text-ink">
            <Avatar profile={author} className="size-7" />
            {author.display_name}
          </Link>
        )}
        {mine && (
          <span className="inline-flex items-center gap-1">
            <vis.icon className="size-3.5" aria-hidden="true" />
            {vis.label}
          </span>
        )}
      </div>

      {cover && (
        <div className="mt-6 grid gap-2">
          <ProgressiveImage eager src={urls[cover.path]} placeholder={cover.placeholder} width={cover.width} height={cover.height} alt={entry.title ?? ''} className="rounded-xl" />
          {rest.length > 0 && (
            <div className="grid grid-cols-2 gap-2">
              {rest.map((p) => (
                <a key={p.id} href={urls[p.path]} target="_blank" rel="noreferrer" aria-label="Ver la foto completa">
                  <ProgressiveImage src={urls[p.thumb_path]} placeholder={p.placeholder} width={p.width} height={p.height} alt="" ratio={4 / 3} className="rounded-lg" />
                </a>
              ))}
            </div>
          )}
        </div>
      )}

      {entry.body && <div className="mt-8 whitespace-pre-line text-[17px] leading-8">{entry.body}</div>}

      {recipe && (
        <section className="mt-10 rounded-xl border border-line bg-paper p-5">
          <h3 className="font-serif text-xl font-medium">{recipe.title}</h3>
          {recipe.source_url && (
            <a href={recipe.source_url} target="_blank" rel="noreferrer noopener" className="mt-1 inline-flex items-center gap-1 text-sm text-clay-soft hover:underline">
              Receta original <ExternalLink className="size-3.5" aria-hidden="true" />
            </a>
          )}
          {recipe.ingredients.length > 0 && (
            <>
              <h4 className="mt-4 text-sm font-medium">Ingredientes</h4>
              <ul className="mt-1 list-disc pl-5 leading-7">
                {recipe.ingredients.map((x, i) => (
                  <li key={i}>{x}</li>
                ))}
              </ul>
            </>
          )}
          {recipe.steps.length > 0 && (
            <>
              <h4 className="mt-4 text-sm font-medium">Pasos</h4>
              <ol className="mt-1 list-decimal pl-5 leading-7">
                {recipe.steps.map((x, i) => (
                  <li key={i} className="pl-1">
                    {x}
                  </li>
                ))}
              </ol>
            </>
          )}
        </section>
      )}

      {mine && (
        <div className="mt-10 flex items-center gap-3">
          <Link to={`/e/${entry.id}/edit`} className={btnSecondary}>
            Editar
          </Link>
          <button className={btnSecondary} onClick={remove} disabled={deleting}>
            {deleting ? 'Borrando…' : 'Borrar'}
          </button>
          {error && <p role="alert" className="text-sm text-clay">{error}</p>}
        </div>
      )}
    </article>
  )
}
