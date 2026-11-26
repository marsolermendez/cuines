import { useQueryClient } from '@tanstack/react-query'
import { Heart } from 'lucide-react'
import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useMe } from '../auth/profiles'

type Props = { entryId: string; initialLiked: boolean; initialCount: number }

/** «Me gusta» con respuesta inmediata: cambia al pulsar y se deshace si el servidor lo rechaza. */
export default function LikeButton({ entryId, initialLiked, initialCount }: Props) {
  const me = useMe()
  const queryClient = useQueryClient()
  const [liked, setLiked] = useState(initialLiked)
  const [count, setCount] = useState(initialCount)
  const [busy, setBusy] = useState(false)

  async function toggle() {
    if (busy) return
    setBusy(true)
    const next = !liked
    const apply = (on: boolean) => {
      setLiked(on)
      setCount((c) => c + (on ? 1 : -1))
    }
    apply(next)
    const { error } = next
      ? await supabase.from('likes').insert({ entry_id: entryId, user_id: me.id })
      : await supabase.from('likes').delete().eq('entry_id', entryId).eq('user_id', me.id)
    if (error) apply(!next)
    else void queryClient.invalidateQueries({ queryKey: ['diary'] })
    setBusy(false)
  }

  return (
    <button
      onClick={toggle}
      aria-pressed={liked}
      aria-label={liked ? 'Quitar me gusta' : 'Me gusta'}
      className={`-mx-2 inline-flex min-h-10 items-center gap-1.5 rounded-lg px-2 text-sm ${liked ? 'text-clay' : 'text-ink-soft hover:text-ink'}`}
    >
      <Heart className={`size-5 ${liked ? 'fill-current' : ''}`} aria-hidden="true" />
      {count}
    </button>
  )
}
