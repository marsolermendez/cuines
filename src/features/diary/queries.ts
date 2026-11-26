import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { monthBounds } from '../../lib/dates'
import { supabase } from '../../lib/supabase'

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

export function useEntry(id: string | undefined) {
  return useQuery({
    queryKey: ['diary', 'entry', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('entries')
        .select(
          '*, recipes(id, title, source_url, ingredients, steps), entry_photos(id, position, path, thumb_path, placeholder, width, height), profiles(id, username, display_name, avatar_url)',
        )
        .eq('id', id!)
        .order('position', { referencedTable: 'entry_photos' })
        .maybeSingle()
      if (error) throw error
      return data
    },
  })
}
