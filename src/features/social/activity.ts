import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useSession } from '../auth/AuthProvider'

// Actividad = me gusta y comentarios de otras personas en mis entradas. No hay tabla ni migración nueva: se lee de
// `likes` y `comments` (la RLS ya los deja ver a quien puede leer la entrada, y yo siempre leo las mías).
// Techo: solo las últimas 30 de cada tipo, sin paginar.

const LIMIT = 30
const WHO = 'username, display_name, avatar_url'

type Who = { username: string | null; display_name: string; avatar_url: string | null }

export type ActivityItem = {
  key: string
  kind: 'like' | 'comment'
  at: string
  body?: string
  entry: { id: string; title: string | null }
  who: Who
}

/** Los me gusta y comentarios más recientes en mis entradas, mezclados y de nuevo a antiguo. */
export function useActivity() {
  const uid = useSession().session?.user.id
  return useQuery({
    queryKey: ['diary', 'activity', uid],
    enabled: !!uid,
    queryFn: async (): Promise<ActivityItem[]> => {
      const [likes, comments] = await Promise.all([
        supabase
          .from('likes')
          .select(`created_at, entry_id, user_id, entries!inner(id, title), profiles!likes_user_id_fkey(${WHO})`)
          .eq('entries.author_id', uid!)
          .neq('user_id', uid!)
          .order('created_at', { ascending: false })
          .limit(LIMIT),
        supabase
          .from('comments')
          .select(`id, body, created_at, entries!inner(id, title), profiles!comments_author_id_fkey(${WHO})`)
          .eq('entries.author_id', uid!)
          .neq('author_id', uid!)
          .order('created_at', { ascending: false })
          .limit(LIMIT),
      ])
      if (likes.error) throw likes.error
      if (comments.error) throw comments.error

      const items: ActivityItem[] = [
        ...likes.data.flatMap((l) =>
          l.entries && l.profiles ? [{ key: `l-${l.entry_id}-${l.user_id}`, kind: 'like' as const, at: l.created_at, entry: l.entries, who: l.profiles }] : [],
        ),
        ...comments.data.flatMap((c) =>
          c.entries && c.profiles ? [{ key: `c-${c.id}`, kind: 'comment' as const, at: c.created_at, body: c.body, entry: c.entries, who: c.profiles }] : [],
        ),
      ]
      return items.sort((a, b) => Date.parse(b.at) - Date.parse(a.at)).slice(0, LIMIT)
    },
  })
}

// Qué es «nuevo»: lo posterior a la última vez que abrí Actividad. Se guarda en este navegador (localStorage), no en
// la base de datos: cada dispositivo tiene su propio «visto». Si se quiere sincronizado, columna en `profiles`.
// La primera vez no hay marca y arranca en «ahora»: no se avisa de lo que ya había.

const seenKey = (uid: string) => `cuines:activity-seen:${uid}`

function readSeen(uid: string): string {
  const now = new Date().toISOString()
  try {
    const stored = localStorage.getItem(seenKey(uid))
    if (stored) return stored
    localStorage.setItem(seenKey(uid), now)
  } catch {
    // Sin almacenamiento (modo privado…): el «visto» vive solo en memoria mientras dure la sesión.
  }
  return now
}

export const isNew = (at: string, seen: string) => Date.parse(at) > Date.parse(seen)

/** Marca de «visto» compartida por la barra de navegación (insignia) y la pantalla de Actividad. */
export function useActivitySeen() {
  const uid = useSession().session!.user.id
  const queryClient = useQueryClient()
  const queryKey = ['activity-seen', uid]
  const { data } = useQuery({ queryKey, queryFn: () => readSeen(uid), initialData: () => readSeen(uid), staleTime: Infinity })
  const markSeen = () => {
    const now = new Date().toISOString()
    try {
      localStorage.setItem(seenKey(uid), now)
    } catch {
      // ver readSeen
    }
    queryClient.setQueryData(queryKey, now)
  }
  return { seen: data, markSeen }
}
