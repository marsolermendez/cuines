import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import Loading from '../../components/Loading'
import { btnPrimary, btnSecondary, inputCls } from '../../components/ui'
import { draftNotesSchema, recipeDraftSchema } from '../../lib/schemas'
import { useTitle } from '../../lib/useTitle'
import { useMe } from '../auth/profiles'
import { PhotosField, usePhotos } from './PhotosField'
import { RecipeFields, RecipeSummary, recipeInput, recipeValues } from './RecipeFields'
import { hasRecipe, useEntry, type Loaded } from './queries'
import { saveEntry, useSaver } from './save'

/** Crear (`/draft/new`) y editar (`/draft/:id`) una receta para cocinar más adelante. Siempre privada. */
export default function DraftForm() {
  const { id } = useParams()
  const me = useMe()
  const { data: entry, isPending, isError } = useEntry(id)
  useTitle(id ? 'Editar receta guardada' : 'Quiero cocinar')

  if (id) {
    if (isPending) return <Loading cards={1} />
    if (isError || !entry || !hasRecipe(entry)) return <p>No se encontró este borrador.</p>
    if (entry.author_id !== me.id) return <p>Los borradores son privados.</p>
    if (entry.status !== 'draft') return <Navigate to={`/e/${id}`} replace />
  }
  return <DraftFormBody key={id ?? 'new'} existing={entry && hasRecipe(entry) ? entry : undefined} />
}

function DraftFormBody({ existing }: { existing?: Loaded }) {
  const me = useMe()
  const navigate = useNavigate()
  const [recipe, setRecipe] = useState(recipeValues(existing?.recipes))
  const [notes, setNotes] = useState(existing?.body ?? '')
  const [tags, setTags] = useState(existing?.tags.join(', ') ?? '')
  const [plannedFor, setPlannedFor] = useState(existing?.planned_for ?? '')
  const photos = usePhotos(existing?.entry_photos ?? [])
  const { saving, error, setError, progress, run } = useSaver()
  // Un borrador creado con «Guardar para cocinar» enlaza una receta de otra persona: se ve, pero no se edita aquí.
  const recipeIsMine = !existing || existing.recipes.owner_id === me.id

  function save(e: FormEvent) {
    e.preventDefault()
    const parsed = draftNotesSchema.safeParse({ body: notes, tags, planned_for: plannedFor })
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? 'Revisa los datos')
    const recipeParsed = recipeIsMine ? recipeDraftSchema.safeParse(recipeInput(recipe)) : null
    if (recipeParsed && !recipeParsed.success) return setError(recipeParsed.error.issues[0]?.message ?? 'Revisa la receta')
    const f = parsed.data
    const r = recipeParsed?.success ? recipeParsed.data : undefined
    const recipeFields = r && { title: r.recipe_title, source_url: r.source_url || null, ingredients: r.ingredients, steps: r.steps }
    void run(
      (onProgress) =>
        saveEntry({
          authorId: me.id,
          existing: existing && { id: existing.id, recipeId: existing.recipes.id, photos: existing.entry_photos },
          recipe: recipeFields,
          entry: {
            status: 'draft',
            visibility: 'private',
            title: null,
            body: f.body,
            cooked_on: null,
            planned_for: f.planned_for || null,
            tags: f.tags,
            // Un borrador nuevo va al final de la lista manual; al editar no se toca su sitio.
            ...(existing ? {} : { position: Date.now() }),
          },
          kept: photos.kept,
          added: photos.added.map((a) => a.file),
          onProgress,
        }),
      () => navigate('/draft'),
    )
  }

  return (
    <form onSubmit={save} className="grid gap-8">
      <h2 className="font-serif text-2xl font-medium">{existing ? 'Editar receta guardada' : 'Quiero cocinar'}</h2>

      {recipeIsMine ? (
        <RecipeFields value={recipe} onChange={setRecipe} titlePlaceholder="Kebab casero" />
      ) : (
        <section className="grid gap-3">
          <h3 className="font-serif text-lg font-medium">Receta</h3>
          <RecipeSummary recipe={existing.recipes} note="Es una receta de otra persona: solo la edita quien la creó." />
        </section>
      )}

      <section className="grid gap-4">
        <label className="grid gap-1 text-sm">
          Notas <span className="text-ink-soft">(opcional)</span>
          <textarea className={inputCls} rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={20000} placeholder="Probar con menos sal, ver cómo lo hace Ana…" />
        </label>
        <label className="grid gap-1 text-sm">
          Etiquetas <span className="text-ink-soft">(separadas por comas, opcional)</span>
          <input className={inputCls} value={tags} onChange={(e) => setTags(e.target.value)} placeholder="cena, rápido, para invitados" />
        </label>
        <label className="grid gap-1 text-sm">
          Para cocinarla el día <span className="text-ink-soft">(opcional)</span>
          <input type="date" className={`${inputCls} max-w-48`} value={plannedFor} onChange={(e) => setPlannedFor(e.target.value)} />
        </label>
      </section>

      <PhotosField photos={photos} hint="opcionales, de referencia" />

      <p className="-mt-4 text-sm text-ink-soft">Esto es solo para ti: nadie más ve lo que guardas en Quiero cocinar.</p>

      <div className="flex flex-wrap items-center gap-3">
        <button className={btnPrimary} disabled={saving}>
          {saving ? (progress ?? 'Guardando…') : 'Guardar'}
        </button>
        {existing && (
          <Link to={`/new?from=${existing.id}`} className={btnSecondary}>
            Cocinar ahora
          </Link>
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
