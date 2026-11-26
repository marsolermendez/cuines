import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import ErrorState from '../../components/ErrorState'
import Loading from '../../components/Loading'
import { btnPrimary, btnSecondary } from '../../components/ui'
import { useTitle } from '../../lib/useTitle'
import { supabase } from '../../lib/supabase'
import { useMe } from '../auth/profiles'
import EntryCard from './EntryCard'
import RecipeBody from './RecipeBody'
import { useSignedUrls } from './photos'
import { useMyDraftOf, useRecipe, useRecipeEntries, useRecipeStats } from './queries'
import { deleteEntry } from './save'

/**
 * Una receta con identidad: la misma receta cocinada muchas veces y por varias personas. Los contadores y las listas
 * son solo lo que quien mira puede ver (la base de datos filtra), así que nadie puede deducir cocinados en privado.
 */
export default function RecipePage() {
  const { id } = useParams()
  const me = useMe()
  const queryClient = useQueryClient()
  const { data: recipe, isPending, isError, refetch } = useRecipe(id)
  useTitle(recipe?.title)
  const { data: stats } = useRecipeStats(id)
  const { data: entries = [] } = useRecipeEntries(id)
  const { data: draft } = useMyDraftOf(id)
  const urls = useSignedUrls(entries.flatMap((e) => e.entry_photos.map((p) => p.thumb_path)))
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<{ text: string; undoId?: string } | null>(null)

  if (isPending) return <Loading cards={1} />
  if (isError) return <ErrorState message="No se pudo cargar la receta." onRetry={() => refetch()} />
  // La RLS no distingue «no existe» de «no puedes verla»: una receta existe para ti si es tuya o la usa algo que ves.
  if (!recipe) return <p>Esta receta no existe o no puedes verla.</p>

  const mine = entries.filter((e) => e.author_id === me.id)
  const others = entries.filter((e) => e.author_id !== me.id)
  const owner = recipe.profiles

  async function save() {
    if (!recipe) return
    setBusy(true)
    setNotice(null)
    const { data, error } = await supabase.rpc('save_as_draft', { rid: recipe.id })
    if (error || !data) setNotice({ text: 'No se pudo guardar. Inténtalo de nuevo.' })
    else {
      await queryClient.invalidateQueries({ queryKey: ['diary'] })
      setNotice({ text: 'Guardada en Quiero cocinar.', undoId: data })
    }
    setBusy(false)
  }

  async function undo() {
    if (!notice?.undoId) return
    setBusy(true)
    // Solo el borrador: la receta no es mía y no se toca.
    await deleteEntry(notice.undoId, null).catch(() => undefined)
    await queryClient.invalidateQueries({ queryKey: ['diary'] })
    setNotice(null)
    setBusy(false)
  }

  return (
    <article>
      <h2 className="font-serif text-3xl font-medium leading-tight">{recipe.title}</h2>
      <p className="mt-1 text-sm text-ink-soft">
        {stats && stats.times > 0
          ? `Hecha ${stats.times} ${stats.times === 1 ? 'vez' : 'veces'} · ${stats.people} ${stats.people === 1 ? 'persona' : 'personas'}`
          : 'Todavía nadie la ha cocinado'}
        {owner && (
          <>
            {' · '}receta de{' '}
            <Link to={`/u/${owner.username}`} className="text-ink hover:underline">
              @{owner.username}
            </Link>
          </>
        )}
      </p>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Link to={`/new?recipe=${recipe.id}`} className={btnPrimary}>
          Cocinar otra vez
        </Link>
        {draft && !notice ? (
          <Link to={`/draft/${draft.id}`} className={btnSecondary}>
            Guardada en Quiero cocinar
          </Link>
        ) : (
          !notice && (
            <button className={btnSecondary} onClick={save} disabled={busy}>
              Guardar para cocinar
            </button>
          )
        )}
        {notice && (
          <p role="status" className="flex items-center gap-3 text-sm">
            {notice.text}
            {notice.undoId && (
              <button className="text-clay underline" onClick={undo} disabled={busy}>
                Deshacer
              </button>
            )}
          </p>
        )}
      </div>

      <section className="mt-8 rounded-xl border border-line bg-paper p-5">
        <RecipeBody recipe={recipe} />
        {recipe.ingredients.length === 0 && recipe.steps.length === 0 && !recipe.source_url && (
          <p className="text-sm text-ink-soft">Esta receta aún no tiene ingredientes ni pasos.</p>
        )}
      </section>

      <section className="mt-10" aria-labelledby="tus-veces">
        <h3 id="tus-veces" className="font-serif text-xl font-medium">
          Tus veces{mine.length > 0 ? ` (${mine.length})` : ''}
        </h3>
        {mine.length === 0 ? (
          <p className="mt-2 text-sm text-ink-soft">Aún no la has cocinado.</p>
        ) : (
          <div className="mt-3 grid gap-4">
            {mine.map((e) => (
              <EntryCard key={e.id} entry={e} urls={urls} showVisibility />
            ))}
          </div>
        )}
      </section>

      <section className="mt-10" aria-labelledby="otras-personas">
        <h3 id="otras-personas" className="font-serif text-xl font-medium">
          Otras personas{others.length > 0 ? ` (${others.length})` : ''}
        </h3>
        <p className="mt-1 text-sm text-ink-soft">Solo lo que tú puedes ver.</p>
        {others.length === 0 ? (
          <p className="mt-2 text-sm text-ink-soft">Nadie más la ha compartido contigo.</p>
        ) : (
          <div className="mt-3 grid gap-4">
            {others.map((e) => (
              <EntryCard key={e.id} entry={e} urls={urls} author={e.profiles} />
            ))}
          </div>
        )}
      </section>
    </article>
  )
}
