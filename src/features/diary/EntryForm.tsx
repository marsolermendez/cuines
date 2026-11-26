import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import Loading from '../../components/Loading'
import { btnPrimary, btnSecondary, inputCls } from '../../components/ui'
import { today } from '../../lib/dates'
import { useTitle } from '../../lib/useTitle'
import { entryFormSchema, recipeDraftSchema, recipeFormSchema } from '../../lib/schemas'
import { supabase } from '../../lib/supabase'
import type { Visibility } from '../../lib/types'
import { useMe } from '../auth/profiles'
import ParticipantsField from '../social/ParticipantsField'
import type { Person } from '../social/usePeopleSearch'
import { PhotosField, usePhotos } from './PhotosField'
import RecipePicker, { type LinkedRecipe } from './RecipePicker'
import { RecipeFields, RecipeSummary, recipeInput, recipeValues } from './RecipeFields'
import { hasRecipe, useEntry, useRecipe, type Loaded } from './queries'
import { saveEntry, syncParticipants, useSaver, type RecipeFields as RecipeData } from './save'
import { VISIBILITY } from './visibility'

const storyCls =
  'field-sizing-content min-h-48 w-full rounded-lg border border-field bg-paper px-3 py-2 text-base leading-7 focus-visible:border-clay'

/**
 * Cuatro usos del mismo formulario:
 *  - `/new`            entrada nueva, con receta nueva o enlazando una que ya existe (o «Guardar en Quiero cocinar»)
 *  - `/new?recipe=:id` «Cocinar otra vez»: la receta ya viene elegida
 *  - `/e/:id/edit`     editar una entrada publicada
 *  - `/new?from=:id`   «Cocinar ahora»: publica un borrador. Nada cambia hasta pulsar Publicar; si cancelas, sigue siendo borrador.
 */
export default function EntryForm() {
  const { id } = useParams()
  const params = useSearchParams()[0]
  const from = params.get('from') ?? undefined
  const recipeParam = params.get('recipe') ?? undefined
  const sourceId = id ?? from
  const me = useMe()
  const { data: entry, isPending, isError } = useEntry(sourceId)
  const { data: preset, isPending: presetPending } = useRecipe(sourceId ? undefined : recipeParam)
  useTitle(id ? 'Editar entrada' : from ? 'Cocinar ahora' : 'Nueva entrada')

  if (sourceId) {
    if (isPending) return <Loading cards={1} />
    if (isError || !entry || !hasRecipe(entry)) return <p>No se encontró la entrada.</p>
    if (entry.author_id !== me.id) return <p>Solo quien la escribió puede editarla.</p>
    // Cada ruta con su tipo: un borrador se edita en /draft/:id y una publicada ya no se «cocina ahora».
    if (id && entry.status === 'draft') return <Navigate to={`/draft/${id}`} replace />
    if (from && entry.status !== 'draft') return <Navigate to={`/e/${from}`} replace />
  } else if (recipeParam) {
    if (presetPending) return <Loading cards={1} />
    if (!preset) return <p>No se encontró la receta, o no puedes verla.</p>
  }
  return (
    <EntryFormBody
      key={sourceId ?? recipeParam ?? 'new'}
      existing={entry && hasRecipe(entry) ? entry : undefined}
      preset={preset ? { id: preset.id, title: preset.title } : undefined}
    />
  )
}

function EntryFormBody({ existing, preset }: { existing?: Loaded; preset?: LinkedRecipe }) {
  const me = useMe()
  const navigate = useNavigate()
  const converting = existing?.status === 'draft'

  const [title, setTitle] = useState(converting ? existing.recipes.title : (existing?.title ?? preset?.title ?? ''))
  const [cookedOn, setCookedOn] = useState((!converting && existing?.cooked_on) || today())
  const [body, setBody] = useState(existing?.body ?? '')
  const [visibility, setVisibility] = useState<Visibility>(
    existing && !converting ? (existing.visibility as Visibility) : me.is_private ? 'followers' : 'public',
  )
  // Receta: propia y editable aquí (nueva o ya mía), enlazada a una existente, o ajena (solo se ve).
  const [mode, setMode] = useState<'new' | 'link'>(preset ? 'link' : 'new')
  const [linked, setLinked] = useState<LinkedRecipe | null>(preset ?? null)
  const [recipe, setRecipe] = useState(recipeValues(existing?.recipes))
  const recipeIsMine = !existing || existing.recipes.owner_id === me.id
  const editableRecipe = existing ? recipeIsMine : mode === 'new'

  const initialPeople = (existing?.entry_participants ?? []).flatMap((p) => (p.profiles ? [p.profiles] : []))
  const [people, setPeople] = useState<Person[]>(initialPeople)
  const pendingIds = new Set((existing?.entry_participants ?? []).filter((p) => p.status === 'pending').map((p) => p.user_id))

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
    const entryParsed = entryFormSchema.safeParse({ title, cooked_on: cookedOn, body, visibility })
    if (!entryParsed.success) return setError(entryParsed.error.issues[0]?.message ?? 'Revisa los datos')
    const recipeParsed = editableRecipe ? recipeFormSchema.safeParse(recipeInput(recipe)) : null
    if (recipeParsed && !recipeParsed.success) return setError(recipeParsed.error.issues[0]?.message ?? 'Revisa la receta')
    if (!existing && mode === 'link' && !linked) return setError('Elige la receta que has cocinado')
    if (photos.total === 0) return setError('Añade al menos una foto')

    const f = entryParsed.data
    const add = people.filter((p) => !initialPeople.some((i) => i.id === p.id)).map((p) => p.id)
    const remove = initialPeople.filter((i) => !people.some((p) => p.id === i.id)).map((i) => i.id)
    let tagsSaved = true
    void run(
      async (onProgress) => {
        const entryId = await saveEntry({
          authorId: me.id,
          existing: existingRef,
          recipe: recipeParsed?.success ? toRecipe(recipeParsed.data) : undefined,
          linkRecipeId: !existing && mode === 'link' ? linked?.id : undefined,
          // Convertir un borrador es este UPDATE: pasa a publicada y pierde la fecha prevista (lo exige el CHECK).
          entry: { status: 'published', visibility: f.visibility, title: f.title, body: f.body, cooked_on: f.cooked_on, planned_for: null },
          kept: photos.kept,
          added: photos.added.map((a) => a.file),
          onProgress,
        })
        // Etiquetar va después, con la entrada ya publicada (la base de datos solo lo permite en publicadas).
        tagsSaved = await syncParticipants(entryId, add, remove)
        return entryId
      },
      (entryId) =>
        navigate(`/e/${entryId}`, {
          replace: !!existing,
          state: tagsSaved ? undefined : { notice: 'La entrada se guardó, pero no se pudo etiquetar a todas las personas. Puedes repetirlo editándola.' },
        }),
    )
  }

  /** «Guardar en Quiero cocinar»: un borrador solo con la receta (sin relato ni fotos). */
  function saveForLater() {
    if (mode === 'link') {
      if (!linked) return setError('Elige una receta')
      const recipeId = linked.id
      return void run(async () => {
        const { data, error } = await supabase.rpc('save_as_draft', { rid: recipeId })
        if (error) throw error
        return data
      }, () => navigate('/draft'))
    }
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

  const tab = (active: boolean) =>
    `rounded-lg px-3 py-1.5 text-sm ${active ? 'bg-ink text-white' : 'border border-line bg-paper text-ink-soft hover:bg-cream'}`

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

      {existing ? (
        recipeIsMine ? (
          <RecipeFields value={recipe} onChange={setRecipe} />
        ) : (
          <section className="grid gap-3">
            <h3 className="font-serif text-lg font-medium">Receta</h3>
            <RecipeSummary recipe={existing.recipes} note="Es una receta de otra persona: solo la edita quien la creó." />
          </section>
        )
      ) : (
        <section className="grid gap-4">
          <h3 className="font-serif text-lg font-medium">Receta</h3>
          <div className="flex gap-2" role="group" aria-label="Origen de la receta">
            <button type="button" aria-pressed={mode === 'new'} className={tab(mode === 'new')} onClick={() => setMode('new')}>
              Receta nueva
            </button>
            <button type="button" aria-pressed={mode === 'link'} className={tab(mode === 'link')} onClick={() => setMode('link')}>
              Una que ya existe
            </button>
          </div>
          {mode === 'new' ? (
            <RecipeFields heading={false} value={recipe} onChange={setRecipe} titlePlaceholder="Cocido de la abuela" />
          ) : linked ? (
            <RecipeSummary recipe={linked} note="Cuenta como otra vez que se cocina esta receta." onChange={preset ? undefined : () => setLinked(null)} />
          ) : (
            <RecipePicker onPick={setLinked} />
          )}
        </section>
      )}

      <ParticipantsField value={people} onChange={setPeople} pending={pendingIds} />

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
