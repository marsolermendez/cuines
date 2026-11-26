import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { monthBounds } from '../../lib/dates'
import { supabase } from '../../lib/supabase'
import { useSession } from '../auth/AuthProvider'

// Todas las consultas de lectura cuelgan de ['diary', ...]: un solo invalidateQueries tras guardar o borrar.
// Qué filas llegan lo decide la RLS (entries_select): aquí solo se filtra por autoría y estado.

const PAGE = 20

// `diary_items` es la vista del diario de una persona: lo que escribió más aquello donde está etiquetada y aceptó.
// Es una vista, así que los tipos generados marcan todo como nulo: se afinan aquí. (RLS: la vista es SECURITY INVOKER.)
export type DiaryRow = {
  id: string
  title: string
  body: string
  cooked_on: string
  visibility: string
  /** Escrita por otra persona (estoy etiquetada): se enseña «con @autora». */
  shared: boolean
  author_username: string
  author_display_name: string
  recipes: { id: string; title: string }
  entry_photos: { position: number; thumb_path: string; placeholder: string; width: number; height: number }[]
}

export type DiaryDay = Pick<DiaryRow, 'id' | 'title' | 'cooked_on' | 'visibility' | 'shared' | 'author_display_name'>

export function useTimeline(authorId: string | undefined) {
  return useInfiniteQuery({
    queryKey: ['diary', 'timeline', authorId],
    enabled: !!authorId,
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const { data, error } = await supabase
        .from('diary_items')
        .select('id, title, body, cooked_on, visibility, shared, author_username, author_display_name, recipes(id, title), entry_photos(position, thumb_path, placeholder, width, height)')
        .eq('diary_owner', authorId!)
        .order('cooked_on', { ascending: false })
        .order('created_at', { ascending: false })
        // Solo la foto de portada de cada entrada.
        .order('position', { referencedTable: 'entry_photos' })
        .limit(1, { referencedTable: 'entry_photos' })
        .range(pageParam, pageParam + PAGE - 1)
        .overrideTypes<DiaryRow[], { merge: false }>()
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
        .from('diary_items')
        .select('id, title, cooked_on, visibility, shared, author_display_name')
        .eq('diary_owner', authorId!)
        .gte('cooked_on', first)
        .lte('cooked_on', last)
        .order('cooked_on')
        .order('created_at')
        .overrideTypes<DiaryDay[], { merge: false }>()
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
          '*, recipes(id, owner_id, title, source_url, ingredients, steps), entry_photos(id, position, path, thumb_path, placeholder, width, height), profiles!entries_author_id_fkey(id, username, display_name, avatar_url), likes(user_id), entry_participants(user_id, status, profiles!entry_participants_user_id_fkey(id, username, display_name, avatar_url))',
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

// ---------------------------------------------------------------------------------------------- recetas

const NOT_SEEN = '00000000-0000-0000-0000-000000000000'

/** Una receta, si la veo: la RLS exige que sea mía o que alguna entrada que puedo leer la use. */
export function useRecipe(id: string | undefined) {
  return useQuery({
    queryKey: ['diary', 'recipe', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('recipes')
        .select('id, owner_id, title, source_url, ingredients, steps, profiles!recipes_owner_id_fkey(username, display_name)')
        .eq('id', id!)
        .maybeSingle()
      if (error) throw error
      return data
    },
  })
}

/** «Hecha N veces · M personas»: solo cuenta lo que yo puedo ver (la función pasa por mi RLS). */
export function useRecipeStats(recipeId: string | undefined) {
  return useQuery({
    queryKey: ['diary', 'recipe-stats', recipeId],
    enabled: !!recipeId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('recipe_stats', { rid: recipeId! }).single()
      if (error) throw error
      return { times: Number(data.times), people: Number(data.people) }
    },
  })
}

/** Las veces que se ha cocinado una receta y yo puedo ver, con su portada y quién la escribió. */
export function useRecipeEntries(recipeId: string | undefined) {
  return useQuery({
    queryKey: ['diary', 'recipe-entries', recipeId],
    enabled: !!recipeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('entries')
        .select(
          'id, title, body, cooked_on, visibility, author_id, profiles!entries_author_id_fkey(username, display_name, avatar_url), entry_photos(position, thumb_path, placeholder, width, height)',
        )
        .eq('recipe_id', recipeId!)
        .eq('status', 'published')
        .order('cooked_on', { ascending: false })
        .order('position', { referencedTable: 'entry_photos' })
        .limit(1, { referencedTable: 'entry_photos' })
      if (error) throw error
      return data
    },
  })
}

/** Mi borrador de esa receta, si ya la guardé en Quiero cocinar. */
export function useMyDraftOf(recipeId: string | undefined) {
  const uid = useSession().session?.user.id ?? NOT_SEEN
  return useQuery({
    queryKey: ['diary', 'draft-of', recipeId, uid],
    enabled: !!recipeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('entries')
        .select('id')
        .eq('recipe_id', recipeId!)
        .eq('author_id', uid)
        .eq('status', 'draft')
        .maybeSingle()
      if (error) throw error
      return data
    },
  })
}

/** Buscar entre las recetas que puedo ver («una que ya tengo»). */
export function useRecipeSearch(text: string) {
  const q = text.trim().replace(/[%,()*\\]/g, ' ').trim()
  return useQuery({
    queryKey: ['diary', 'recipe-search', q],
    enabled: q.length >= 2,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('recipes')
        .select('id, title, profiles!recipes_owner_id_fkey(username)')
        .ilike('title', `%${q}%`)
        .order('title')
        .limit(8)
      if (error) throw error
      return data
    },
  })
}

export type RecipebookRow = { recipe_id: string; cooked_on: string; recipes: { id: string; title: string } }

/** El recetario de un diario: las veces cocinadas (propias y etiquetadas) para agrupar por receta en el cliente. */
export function useRecipebook(ownerId: string | undefined) {
  return useQuery({
    queryKey: ['diary', 'recipebook', ownerId],
    enabled: !!ownerId,
    queryFn: async () => {
      // Techo: PostgREST devuelve como mucho 1000 filas; con más veces cocinadas habría que agrupar en SQL.
      const { data, error } = await supabase
        .from('diary_items')
        .select('recipe_id, cooked_on, recipes(id, title)')
        .eq('diary_owner', ownerId!)
        .order('cooked_on', { ascending: false })
        .limit(1000)
        .overrideTypes<RecipebookRow[], { merge: false }>()
      if (error) throw error
      return data
    },
  })
}
