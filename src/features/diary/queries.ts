import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { monthBounds } from '../../lib/dates'
import { supabase } from '../../lib/supabase'
import { useSession } from '../auth/AuthProvider'

// Todas las consultas de lectura cuelgan de ['diary', ...]: un solo invalidateQueries tras guardar o borrar.
// Qué filas llegan lo decide la RLS (entries_select): aquí solo se filtra por autoría y estado.

const PAGE = 20

export function useTimeline(authorId: string | undefined) {
  return useInfiniteQuery({
    queryKey: ['diary', 'timeline', authorId],
    enabled: !!authorId,
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const { data, error } = await supabase
        .from('entries')
        .select('id, title, body, cooked_on, visibility, recipes(id, title), entry_photos(position, thumb_path, placeholder, width, height)')
        .eq('author_id', authorId!)
        .eq('status', 'published')
        .order('cooked_on', { ascending: false })
        .order('created_at', { ascending: false })
        // Solo la foto de portada de cada entrada.
        .order('position', { referencedTable: 'entry_photos' })
        .limit(1, { referencedTable: 'entry_photos' })
        .range(pageParam, pageParam + PAGE - 1)
      if (error) throw error
      return data
    },
    getNextPageParam: (last, all) => (last.length === PAGE ? all.length * PAGE : undefined),
  })
}

export function useDiaryMonth(authorId: string | undefined, month: string) {
  const { first, last } = monthBounds(month)
  return useQuery({
    queryKey: ['diary', 'month', authorId, month],
    enabled: !!authorId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('entries')
        .select('id, title, cooked_on, visibility')
        .eq('author_id', authorId!)
        .eq('status', 'published')
        .gte('cooked_on', first)
        .lte('cooked_on', last)
        .order('cooked_on')
        .order('created_at')
      if (error) throw error
      return data
    },
  })
}

// Con likes, comments y reports, PostgREST ve también «entries ↔ profiles» como relación muchos a muchos a través de
// esas tablas: `profiles(...)` a secas daría 300 (ambiguo). Se nombra la clave foránea de la autoría.
// `likes(user_id)` da a la vez cuántos me gusta hay y si le di yo. Techo: una entrada con miles de me gusta traería
// miles de ids; entonces se pasa a un recuento en SQL.

export function useEntry(id: string | undefined) {
  const uid = useSession().session?.user.id
  return useQuery({
    queryKey: ['diary', 'entry', id, uid],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('entries')
        .select(
          '*, recipes(id, title, source_url, ingredients, steps), entry_photos(id, position, path, thumb_path, placeholder, width, height), profiles!entries_author_id_fkey(id, username, display_name, avatar_url), likes(user_id)',
        )
        .eq('id', id!)
        .order('position', { referencedTable: 'entry_photos' })
        .maybeSingle()
      if (error) throw error
      return data
    },
  })
}

export type EntryData = NonNullable<ReturnType<typeof useEntry>['data']>
export type RecipeData = NonNullable<EntryData['recipes']>
/** Una entrada con su receta cargada (una entrada propia siempre ve la suya). */
export type Loaded = EntryData & { recipes: RecipeData }
export const hasRecipe = (e: EntryData): e is Loaded => !!e.recipes

/** Mis borradores con la foto de portada. Solo los míos: la RLS no deja leer los de nadie más. */
export function useDrafts(authorId: string) {
  return useQuery({
    queryKey: ['diary', 'drafts', authorId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('entries')
        .select('id, body, tags, planned_for, position, created_at, recipes(id, title), entry_photos(position, thumb_path, placeholder, width, height)')
        .eq('author_id', authorId)
        .eq('status', 'draft')
        .order('position', { referencedTable: 'entry_photos' })
        .limit(1, { referencedTable: 'entry_photos' })
      if (error) throw error
      return data
    },
  })
}

const FEED_PAGE = 10

/** Inicio: entradas de las personas a las que sigo (RPC `feed`; la RLS decide qué puedo leer de cada una). */
export function useFeed() {
  const uid = useSession().session?.user.id
  return useInfiniteQuery({
    queryKey: ['diary', 'feed', uid],
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) => {
      const { data, error } = await supabase
        .rpc('feed', { p_before: pageParam ?? undefined, p_limit: FEED_PAGE })
        .select(
          'id, title, body, cooked_on, visibility, published_at, recipes(id, title), entry_photos(position, thumb_path, placeholder, width, height), profiles!entries_author_id_fkey(id, username, display_name, avatar_url), likes(user_id), comment_count:comments(count)',
        )
        .order('published_at', { ascending: false })
        .order('position', { referencedTable: 'entry_photos' })
        .limit(1, { referencedTable: 'entry_photos' })
      if (error) throw error
      return data
    },
    getNextPageParam: (last) => (last.length === FEED_PAGE ? (last[last.length - 1]?.published_at ?? undefined) : undefined),
  })
}

export function useComments(entryId: string) {
  return useQuery({
    queryKey: ['diary', 'comments', entryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('comments')
        .select('id, body, created_at, author_id, profiles!comments_author_id_fkey(username, display_name, avatar_url)')
        .eq('entry_id', entryId)
        .order('created_at')
      if (error) throw error
      return data
    },
  })
}
