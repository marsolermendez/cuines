import { ImagePlus, X } from 'lucide-react'
import { useState, type ChangeEvent } from 'react'
import { MAX_PHOTOS, useSignedUrls, type ExistingPhoto } from './photos'

type Added = { file: File; preview: string }

/** Fotos de un formulario: las que ya tenía la entrada (`kept`, se pueden quitar) y las nuevas (`added`). */
export function usePhotos(initial: ExistingPhoto[]) {
  const [kept, setKept] = useState(initial)
  const [added, setAdded] = useState<Added[]>([])
  const [tooMany, setTooMany] = useState(false)
  const total = kept.length + added.length

  function pick(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    const room = MAX_PHOTOS - total
    setTooMany(files.length > room)
    setAdded([...added, ...files.slice(0, room).map((file) => ({ file, preview: URL.createObjectURL(file) }))])
  }

  return {
    kept,
    added,
    total,
    tooMany,
    pick,
    dropKept: (p: ExistingPhoto) => setKept(kept.filter((k) => k !== p)),
    dropAdded: (a: Added) => {
      URL.revokeObjectURL(a.preview)
      setAdded(added.filter((x) => x !== a))
    },
  }
}

export type PhotosState = ReturnType<typeof usePhotos>

const tile = 'aspect-square w-full rounded-lg bg-line object-cover'
const removeBtn = 'absolute right-1 top-1 rounded-full bg-cream/80 p-1 text-ink hover:bg-cream'

export function PhotosField({ photos, hint }: { photos: PhotosState; hint: string }) {
  const urls = useSignedUrls(photos.kept.map((p) => p.thumb_path))
  return (
    <section>
      <h3 className="mb-2 text-sm font-medium">
        Fotos{' '}
        <span className="font-normal text-ink-soft">
          ({photos.total}/{MAX_PHOTOS}; {hint})
        </span>
      </h3>
      <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {photos.kept.map((p) => (
          <li key={p.id} className="relative">
            <img src={urls[p.thumb_path]} alt="" className={tile} />
            <button type="button" className={removeBtn} aria-label="Quitar foto" onClick={() => photos.dropKept(p)}>
              <X className="size-3.5" />
            </button>
          </li>
        ))}
        {photos.added.map((a) => (
          <li key={a.preview} className="relative">
            <img src={a.preview} alt="" className={tile} />
            <button type="button" className={removeBtn} aria-label="Quitar foto" onClick={() => photos.dropAdded(a)}>
              <X className="size-3.5" />
            </button>
          </li>
        ))}
        {photos.total < MAX_PHOTOS && (
          <li>
            <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-line bg-paper text-xs text-ink-soft hover:bg-cream">
              <ImagePlus className="size-5" aria-hidden="true" />
              Añadir
              <input type="file" accept="image/*" multiple className="sr-only" onChange={photos.pick} />
            </label>
          </li>
        )}
      </ul>
      {photos.tooMany && <p className="mt-2 text-sm text-clay">Máximo {MAX_PHOTOS} fotos: sobraron algunas.</p>}
    </section>
  )
}
