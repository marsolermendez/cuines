import { useQuery } from '@tanstack/react-query'
import { resizeToJpeg } from '../../lib/images'
import { supabase } from '../../lib/supabase'

export const MAX_PHOTOS = 10
const BUCKET = 'photos'

export class PhotoError extends Error {}

const toDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })

/**
 * Una foto → versión completa (1600 px), miniatura (480 px) y placeholder (16 px, base64).
 * Miniatura y placeholder salen de la ya reducida: se decodifica mucho más rápido que el original.
 */
async function processPhoto(file: File) {
  try {
    const full = await resizeToJpeg(file, { maxSide: 1600 })
    const [thumb, tiny] = await Promise.all([
      resizeToJpeg(full.blob, { maxSide: 480, quality: 0.78 }),
      resizeToJpeg(full.blob, { maxSide: 16, quality: 0.5 }),
    ])
    return { full: full.blob, thumb: thumb.blob, placeholder: await toDataUrl(tiny.blob), width: full.width, height: full.height }
  } catch {
    throw new PhotoError(`No se pudo procesar «${file.name}». Prueba con un JPG o PNG.`)
  }
}

/** Una foto ya guardada de una entrada. */
export type ExistingPhoto = {
  id: string
  position: number
  path: string
  thumb_path: string
  placeholder: string
  width: number
  height: number
}

export type NewPhotoRow = {
  entry_id: string
  position: number
  path: string
  thumb_path: string
  width: number
  height: number
  placeholder: string
}

/** Posiciones libres (0 a 9) para `count` fotos nuevas, dado lo que ya está ocupado. */
export function freePositions(used: number[], count: number): number[] {
  const taken = new Set(used)
  const free: number[] = []
  for (let p = 0; p < MAX_PHOTOS && free.length < count; p++) if (!taken.has(p)) free.push(p)
  return free
}

/** Reduce y sube las fotos de 3 en 3. `uploaded` acumula las rutas subidas, para poder limpiarlas si algo falla. */
export async function uploadPhotos(
  files: File[],
  positions: number[],
  authorId: string,
  entryId: string,
  uploaded: string[],
  onProgress: (done: number) => void,
): Promise<NewPhotoRow[]> {
  const rows: NewPhotoRow[] = new Array(files.length)
  let next = 0
  let done = 0
  const worker = async () => {
    while (next < files.length) {
      const i = next++
      const p = await processPhoto(files[i]!)
      const base = `${authorId}/${entryId}/${crypto.randomUUID()}`
      const path = `${base}_full.jpg`
      const thumb_path = `${base}_thumb.jpg`
      for (const [name, blob] of [[path, p.full], [thumb_path, p.thumb]] as const) {
        const { error } = await supabase.storage.from(BUCKET).upload(name, blob, { contentType: 'image/jpeg' })
        if (error) throw error
        uploaded.push(name)
      }
      rows[i] = { entry_id: entryId, position: positions[i]!, path, thumb_path, width: p.width, height: p.height, placeholder: p.placeholder }
      onProgress(++done)
    }
  }
  await Promise.all(Array.from({ length: Math.min(3, files.length) }, worker))
  return rows
}

/** Borra archivos del bucket sin fallar: lo que quede huérfano solo ocupa espacio y nadie más lo lee. */
export async function removePhotoFiles(paths: string[]) {
  if (paths.length) await supabase.storage.from(BUCKET).remove(paths).catch(() => undefined)
}

/** URLs firmadas (1 h) de una lista de rutas, en una sola petición y cacheadas. */
export function useSignedUrls(paths: string[]): Record<string, string> {
  const { data } = useQuery({
    queryKey: ['signed', [...paths].sort().join('|')],
    enabled: paths.length > 0,
    staleTime: 50 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(paths, 3600)
      if (error) throw error
      const urls: Record<string, string> = {}
      for (const d of data) if (d.path && d.signedUrl) urls[d.path] = d.signedUrl
      return urls
    },
  })
  return data ?? {}
}
