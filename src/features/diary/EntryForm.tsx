import { useQueryClient } from '@tanstack/react-query'
import { ImagePlus, X } from 'lucide-react'
import { useState, type ChangeEvent, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { btnPrimary, btnSecondary, inputCls } from '../../components/ui'
import { today } from '../../lib/dates'
import { entryFormSchema } from '../../lib/schemas'
import { supabase } from '../../lib/supabase'
import type { Visibility } from '../../lib/types'
import { useMe } from '../auth/profiles'
import { freePositions, MAX_PHOTOS, PhotoError, removePhotoFiles, uploadPhotos, useSignedUrls } from './photos'
import { useEntry } from './queries'
import { VISIBILITY } from './visibility'

type Existing = NonNullable<ReturnType<typeof useEntry>['data']>
type Added = { file: File; preview: string }

const storyCls =
  'field-sizing-content min-h-48 w-full rounded-lg border border-line bg-paper px-3 py-2 text-base leading-7 outline-none focus:border-clay-soft'

const check = async (q: PromiseLike<{ error: Error | null }>) => {
  const { error } = await q
  if (error) throw error
}

/** Crear (`/new`) y editar (`/e/:id/edit`) una entrada con su receta. */
export default function EntryForm() {
  const { id } = useParams()
  const me = useMe()
  const { data: existing, isPending, isError } = useEntry(id)

  if (id) {
    if (isPending) return <p className="text-ink-soft">Cargando…</p>
    if (isError || !existing) return <p>No se encontró la entrada.</p>
    if (existing.author_id !== me.id) return <p>Solo quien la escribió puede editarla.</p>
  }
  return <EntryFormBody key={id ?? 'new'} existing={existing ?? undefined} />
}

function EntryFormBody({ existing }: { existing?: Existing }) {
  const me = useMe()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const recipe = existing?.recipes

  const [title, setTitle] = useState(existing?.title ?? '')
  const [cookedOn, setCookedOn] = useState(existing?.cooked_on ?? today())
  const [body, setBody] = useState(existing?.body ?? '')
  const [visibility, setVisibility] = useState<Visibility>((existing?.visibility as Visibility) ?? (me.is_private ? 'followers' : 'public'))
  const [recipeTitle, setRecipeTitle] = useState(recipe?.title ?? '')
  const [ingredients, setIngredients] = useState(recipe?.ingredients.join('\n') ?? '')
  const [steps, setSteps] = useState(recipe?.steps.join('\n') ?? '')
  const [sourceUrl, setSourceUrl] = useState(recipe?.source_url ?? '')
  const [kept, setKept] = useState(existing?.entry_photos ?? [])
  const [added, setAdded] = useState<Added[]>([])
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const urls = useSignedUrls(kept.map((p) => p.thumb_path))

  function pick(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    const room = MAX_PHOTOS - kept.length - added.length
    setError(files.length > room ? `Máximo ${MAX_PHOTOS} fotos por entrada.` : null)
    setAdded([...added, ...files.slice(0, room).map((file) => ({ file, preview: URL.createObjectURL(file) }))])
  }

  function dropAdded(a: Added) {
    URL.revokeObjectURL(a.preview)
    setAdded(added.filter((x) => x !== a))
  }

  async function save(e: FormEvent) {
    e.preventDefault()
    if (saving) return
    const parsed = entryFormSchema.safeParse({
      title, cooked_on: cookedOn, body, visibility, recipe_title: recipeTitle, ingredients, steps, source_url: sourceUrl,
    })
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? 'Revisa los datos')
    if (kept.length + added.length === 0) return setError('Añade al menos una foto')

    const f = parsed.data
    setSaving(true)
    setError(null)
    // Los ids se generan aquí para poder subir las fotos antes de que existan las filas: si algo falla no queda
    // una entrada a medias a la vista.
    const entryId = existing?.id ?? crypto.randomUUID()
    const recipeId = recipe?.id ?? crypto.randomUUID()
    const uploaded: string[] = []
    let photosSaved = false
    try {
      const positions = freePositions(kept.map((p) => p.position), added.length)
      const rows = await uploadPhotos(added.map((a) => a.file), positions, me.id, entryId, uploaded, (n) =>
        setProgress(`Subiendo fotos ${n}/${added.length}…`),
      )
      setProgress('Guardando…')
      const recipeFields = { title: f.recipe_title, source_url: f.source_url || null, ingredients: f.ingredients, steps: f.steps }
      const entryFields = { title: f.title, body: f.body, cooked_on: f.cooked_on, visibility: f.visibility }
      if (existing) {
        await check(supabase.from('recipes').update(recipeFields).eq('id', recipeId))
        await check(supabase.from('entries').update(entryFields).eq('id', entryId))
      } else {
        await check(supabase.from('recipes').insert({ id: recipeId, owner_id: me.id, ...recipeFields }))
        await check(supabase.from('entries').insert({ id: entryId, author_id: me.id, recipe_id: recipeId, status: 'published', ...entryFields }))
      }
      // Las fotos quitadas se borran antes de insertar las nuevas: la posición (única por entrada) tiene que quedar libre.
      const removed = (existing?.entry_photos ?? []).filter((p) => !kept.some((k) => k.id === p.id))
      if (removed.length) await check(supabase.from('entry_photos').delete().in('id', removed.map((p) => p.id)))
      if (rows.length) await check(supabase.from('entry_photos').insert(rows))
      photosSaved = true
      await removePhotoFiles(removed.flatMap((p) => [p.path, p.thumb_path]))
      await queryClient.invalidateQueries({ queryKey: ['diary'] })
      navigate(`/e/${entryId}`, { replace: !!existing })
    } catch (err) {
      if (!photosSaved) {
        // Deshace lo creado (borrar la entrada borra sus fotos en cascada) y los archivos ya subidos.
        if (!existing) {
          await supabase.from('entries').delete().eq('id', entryId)
          await supabase.from('recipes').delete().eq('id', recipeId)
        }
        await removePhotoFiles(uploaded)
      }
      setError(err instanceof PhotoError ? err.message : 'No se pudo guardar. Inténtalo de nuevo.')
      setSaving(false)
      setProgress(null)
    }
  }

  const total = kept.length + added.length
  const tile = 'aspect-square w-full rounded-lg bg-line object-cover'
  const removeBtn = 'absolute right-1 top-1 rounded-full bg-ink/70 p-1 text-white hover:bg-ink'

  return (
    <form onSubmit={save} className="grid gap-8">
      <h2 className="font-serif text-2xl font-medium">{existing ? 'Editar entrada' : 'Nueva entrada'}</h2>

      <section>
        <h3 className="mb-2 text-sm font-medium">
          Fotos <span className="font-normal text-ink-soft">({total}/{MAX_PHOTOS}; la primera es la portada)</span>
        </h3>
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {kept.map((p) => (
            <li key={p.id} className="relative">
              <img src={urls[p.thumb_path]} alt="" className={tile} />
              <button type="button" className={removeBtn} aria-label="Quitar foto" onClick={() => setKept(kept.filter((k) => k !== p))}>
                <X className="size-3.5" />
              </button>
            </li>
          ))}
          {added.map((a) => (
            <li key={a.preview} className="relative">
              <img src={a.preview} alt="" className={tile} />
              <button type="button" className={removeBtn} aria-label="Quitar foto" onClick={() => dropAdded(a)}>
                <X className="size-3.5" />
              </button>
            </li>
          ))}
          {total < MAX_PHOTOS && (
            <li>
              <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-line bg-paper text-xs text-ink-soft hover:bg-cream">
                <ImagePlus className="size-5" aria-hidden="true" />
                Añadir
                <input type="file" accept="image/*" multiple className="sr-only" onChange={pick} />
              </label>
            </li>
          )}
        </ul>
      </section>

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

      <section className="grid gap-4">
        <h3 className="font-serif text-lg font-medium">Receta</h3>
        <label className="grid gap-1 text-sm">
          Nombre
          <input className={inputCls} value={recipeTitle} onChange={(e) => setRecipeTitle(e.target.value)} maxLength={120} placeholder="Cocido de la abuela" />
        </label>
        <label className="grid gap-1 text-sm">
          Ingredientes <span className="text-ink-soft">(uno por línea)</span>
          <textarea className={inputCls} rows={5} value={ingredients} onChange={(e) => setIngredients(e.target.value)} />
        </label>
        <label className="grid gap-1 text-sm">
          Pasos <span className="text-ink-soft">(uno por línea)</span>
          <textarea className={inputCls} rows={5} value={steps} onChange={(e) => setSteps(e.target.value)} />
        </label>
        <label className="grid gap-1 text-sm">
          Enlace a la receta original <span className="text-ink-soft">(opcional)</span>
          <input className={inputCls} type="url" value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} placeholder="https://" />
        </label>
      </section>

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
          {saving ? (progress ?? 'Guardando…') : existing ? 'Guardar cambios' : 'Publicar'}
        </button>
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
