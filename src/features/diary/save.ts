import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import type { EntryInsert } from '../../lib/types'
import { freePositions, PhotoError, removePhotoFiles, uploadPhotos, type ExistingPhoto } from './photos'

export type RecipeFields = { title: string; source_url: string | null; ingredients: string[]; steps: string[] }
export type EntryFields = Pick<EntryInsert, 'status' | 'visibility' | 'title' | 'body' | 'cooked_on' | 'planned_for' | 'tags' | 'position'>

const check = async (q: PromiseLike<{ error: Error | null }>) => {
  const { error } = await q
  if (error) throw error
}

type SaveOptions = {
  authorId: string
  /** Entrada que ya existe (editar una publicada o convertir un borrador). Sin ella se crea una nueva. */
  existing?: { id: string; recipeId: string; photos: ExistingPhoto[] }
  recipe: RecipeFields
  entry: EntryFields
  /** De las fotos que ya tenía, las que se conservan; y los archivos nuevos por subir. */
  kept: ExistingPhoto[]
  added: File[]
  onProgress?: (done: number, total: number) => void
}

/**
 * La única vía de escritura de entradas y borradores: receta, entrada y fotos. Devuelve el id de la entrada.
 *
 * Los ids se generan aquí para poder subir las fotos antes de que existan las filas: si algo falla no queda una
 * entrada a medias a la vista. Si falla, se deshace lo creado y se borran los archivos ya subidos.
 */
export async function saveEntry(o: SaveOptions): Promise<string> {
  const entryId = o.existing?.id ?? crypto.randomUUID()
  const recipeId = o.existing?.recipeId ?? crypto.randomUUID()
  const uploaded: string[] = []
  let photosSaved = false
  try {
    const positions = freePositions(o.kept.map((p) => p.position), o.added.length)
    const rows = await uploadPhotos(o.added, positions, o.authorId, entryId, uploaded, (n) => o.onProgress?.(n, o.added.length))

    if (o.existing) {
      await check(supabase.from('recipes').update(o.recipe).eq('id', recipeId))
      await check(supabase.from('entries').update(o.entry).eq('id', entryId))
    } else {
      await check(supabase.from('recipes').insert({ id: recipeId, owner_id: o.authorId, ...o.recipe }))
      await check(supabase.from('entries').insert({ id: entryId, author_id: o.authorId, recipe_id: recipeId, ...o.entry }))
    }

    // Las fotos quitadas se borran antes de insertar las nuevas: la posición (única por entrada) tiene que quedar libre.
    const removed = (o.existing?.photos ?? []).filter((p) => !o.kept.some((k) => k.id === p.id))
    if (removed.length) await check(supabase.from('entry_photos').delete().in('id', removed.map((p) => p.id)))
    if (rows.length) await check(supabase.from('entry_photos').insert(rows))
    photosSaved = true
    await removePhotoFiles(removed.flatMap((p) => [p.path, p.thumb_path]))
    return entryId
  } catch (err) {
    if (!photosSaved) {
      // Borrar la entrada borra sus fotos en cascada.
      if (!o.existing) {
        await supabase.from('entries').delete().eq('id', entryId)
        await supabase.from('recipes').delete().eq('id', recipeId)
      }
      await removePhotoFiles(uploaded)
    }
    throw err
  }
}

/**
 * Borra una entrada o un borrador con sus fotos y, si nadie más la usa, su receta.
 * Primero las filas y luego los archivos: si algo falla a medias queda un archivo huérfano que nadie lee,
 * en vez de una foto rota en el diario.
 */
export async function deleteEntry(id: string, recipeId: string | null) {
  const { data: photos } = await supabase.from('entry_photos').select('path, thumb_path').eq('entry_id', id)
  await check(supabase.from('entries').delete().eq('id', id))
  await removePhotoFiles((photos ?? []).flatMap((p) => [p.path, p.thumb_path]))
  // La base de datos rechaza borrar una receta que aún tiene entradas: ese error se ignora a propósito.
  if (recipeId) await supabase.from('recipes').delete().eq('id', recipeId)
}

/** Estado común de los formularios que guardan: en curso, error y progreso de las fotos. */
export function useSaver() {
  const queryClient = useQueryClient()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState<string | null>(null)

  async function run(task: (onProgress: (done: number, total: number) => void) => Promise<string>, done: (id: string) => void) {
    if (saving) return
    setSaving(true)
    setError(null)
    try {
      const id = await task((n, total) => setProgress(`Subiendo fotos ${n}/${total}…`))
      await queryClient.invalidateQueries({ queryKey: ['diary'] })
      done(id)
    } catch (err) {
      setError(err instanceof PhotoError ? err.message : 'No se pudo guardar. Inténtalo de nuevo.')
      setSaving(false)
      setProgress(null)
    }
  }

  return { saving, error, setError, progress, run }
}
