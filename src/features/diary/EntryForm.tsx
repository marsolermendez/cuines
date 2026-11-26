import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { btnPrimary, btnSecondary, inputCls } from '../../components/ui'
import { today } from '../../lib/dates'
import { entryFormSchema, recipeDraftSchema } from '../../lib/schemas'
import { useMe } from '../auth/profiles'
import { PhotosField, usePhotos } from './PhotosField'
import { RecipeFields, recipeInput, recipeValues } from './RecipeFields'
import { hasRecipe, useEntry, type Loaded } from './queries'
import { saveEntry, useSaver, type RecipeFields as RecipeData } from './save'
import { VISIBILITY } from './visibility'
import type { Visibility } from '../../lib/types'

const storyCls =
  'field-sizing-content min-h-48 w-full rounded-lg border border-line bg-paper px-3 py-2 text-base leading-7 outline-none focus:border-clay-soft'

/**
 * Tres usos del mismo formulario:
 *  - `/new`            entrada nueva (o «Guardar en Quiero cocinar»)
 *  - `/e/:id/edit`     editar una entrada publicada
 *  - `/new?from=:id`   «Cocinar ahora»: publica un borrador. Nada cambia hasta pulsar Publicar; si cancelas, sigue siendo borrador.
 */
export default function EntryForm() {
  const { id } = useParams()
  const from = useSearchParams()[0].get('from') ?? undefined
  const sourceId = id ?? from
  const me = useMe()
  const { data: entry, isPending, isError } = useEntry(sourceId)

  if (sourceId) {
    if (isPending) return <p className="text-ink-soft">Cargando…</p>
    if (isError || !entry || !hasRecipe(entry)) return <p>No se encontró la entrada.</p>
    if (entry.author_id !== me.id) return <p>Solo quien la escribió puede editarla.</p>
    // Cada ruta con su tipo: un borrador se edita en /draft/:id y una publicada ya no se «cocina ahora».
    if (id && entry.status === 'draft') return <Navigate to={`/draft/${id}`} replace />
    if (from && entry.status !== 'draft') return <Navigate to={`/e/${from}`} replace />
  }
  return <EntryFormBody key={sourceId ?? 'new'} existing={entry && hasRecipe(entry) ? entry : undefined} />
}

function EntryFormBody({ existing }: { existing?: Loaded }) {
  const me = useMe()
  const navigate = useNavigate()
  const converting = existing?.status === 'draft'

  const [title, setTitle] = useState(converting ? existing.recipes.title : (existing?.title ?? ''))
  const [cookedOn, setCookedOn] = useState((!converting && existing?.cooked_on) || today())
  const [body, setBody] = useState(existing?.body ?? '')
  const [visibility, setVisibility] = useState<Visibility>(
    existing && !converting ? (existing.visibility as Visibility) : me.is_private ? 'followers' : 'public',
  )
  const [recipe, setRecipe] = useState(recipeValues(existing?.recipes))
  const photos = usePhotos(existing?.entry_photos ?? [])
  const { saving, error, setError, progress, run } = useSaver()

  const existingRef = existing && { id: existing.id, recipeId: existing.recipes.id, photos: existing.entry_photos }
  const toRecipe = (f: { recipe_title: string; source_url: string; ingredients: string[]; steps: string[] }): RecipeData => ({
    title: f.recipe_title,
    source_url: f.source_url || null,
    ingredients: f.ingredients,
    steps: f.steps,
  })

  function publish(e: FormEvent) {
    e.preventDefault()
    const parsed = entryFormSchema.safeParse({ title, cooked_on: cookedOn, body, visibility, ...recipeInput(recipe) })
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? 'Revisa los datos')
    if (photos.total === 0) return setError('Añade al menos una foto')
    const f = parsed.data
    void run(
      (onProgress) =>
        saveEntry({
          authorId: me.id,
          existing: existingRef,
          recipe: toRecipe(f),
          // Convertir un borrador es este UPDATE: pasa a publicada y pierde la fecha prevista (lo exige el CHECK).
          entry: { status: 'published', visibility: f.visibility, title: f.title, body: f.body, cooked_on: f.cooked_on, planned_for: null },
          kept: photos.kept,
          added: photos.added.map((a) => a.file),
          onProgress,
        }),
      (entryId) => navigate(`/e/${entryId}`, { replace: !!existing }),
    )
  }

  /** «Guardar en Quiero cocinar»: crea un borrador solo con la receta (sin relato ni fotos). */
  function saveForLater() {
    const parsed = recipeDraftSchema.safeParse(recipeInput(recipe))
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? 'Revisa los datos')
    void run(
      () =>
        saveEntry({
          authorId: me.id,
          recipe: toRecipe(parsed.data),
          entry: { status: 'draft', visibility: 'private', title: null, body: '', cooked_on: null, planned_for: null, tags: [], position: Date.now() },
          kept: [],
          added: [],
        }),
      () => navigate('/draft'),
    )
  }

  return (
    <form onSubmit={publish} className="grid gap-8">
      <h2 className="font-serif text-2xl font-medium">
        {converting ? 'Cocinar ahora' : existing ? 'Editar entrada' : 'Nueva entrada'}
      </h2>
      {converting && (
        <p className="-mt-4 text-sm text-ink-soft">
          Cuéntanos cómo salió. Hasta que pulses Publicar, la receta sigue en Quiero cocinar.
        </p>
      )}

      <PhotosField photos={photos} hint={converting ? 'las de referencia se pueden quitar; la primera es la portada' : 'la primera es la portada'} />

      <section className="grid gap-4">
        <label className="grid gap-1 text-sm">
          Título
          <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="Domingo de cocido con la abuela" />
        </label>
        <label className="grid gap-1 text-sm">
          Día que lo cocinaste
          <input type="date" className={`${inputCls} max-w-48`} value={cookedOn} onChange={(e) => setCookedOn(e.target.value)} />
        </label>
        <label className="grid gap-1 text-sm">
          Tu relato
          <textarea className={storyCls} value={body} onChange={(e) => setBody(e.target.value)} maxLength={20000} placeholder="Cómo fue: qué salió bien, qué cambiarías, con quién lo comiste…" />
        </label>
      </section>

      <RecipeFields value={recipe} onChange={setRecipe} titlePlaceholder="Cocido de la abuela" />

      <fieldset className="grid gap-2">
        <legend className="mb-1 text-sm font-medium">¿Quién puede verla?</legend>
        {VISIBILITY.map((v) => (
          <label key={v.value} className="flex items-start gap-3 rounded-lg border border-line bg-paper p-3 text-sm has-checked:border-clay-soft">
            <input type="radio" name="visibility" className="mt-1" checked={visibility === v.value} onChange={() => setVisibility(v.value)} />
            <span>
              <span className="flex items-center gap-1.5 font-medium">
                <v.icon className="size-4" aria-hidden="true" />
                {v.label}
              </span>
              <span className="block text-ink-soft">{v.hint}</span>
            </span>
          </label>
        ))}
      </fieldset>

      <div className="flex flex-wrap items-center gap-3">
        <button className={btnPrimary} disabled={saving}>
          {saving ? (progress ?? 'Guardando…') : existing && !converting ? 'Guardar cambios' : 'Publicar'}
        </button>
        {!existing && (
          <button type="button" className={btnSecondary} disabled={saving} onClick={saveForLater}>
            Guardar en Quiero cocinar
          </button>
        )}
        <button type="button" className={btnSecondary} disabled={saving} onClick={() => navigate(-1)}>
          Cancelar
        </button>
        {error && (
          <p role="alert" className="text-sm text-clay">
            {error}
          </p>
        )}
      </div>
    </form>
  )
}
