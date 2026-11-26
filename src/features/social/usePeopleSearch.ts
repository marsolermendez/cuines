import { useQuery } from '@tanstack/react-query'
import { useDebounced } from '../../lib/useDebounced'
import { supabase } from '../../lib/supabase'
import type { Profile } from '../../lib/types'
import { useMe } from '../auth/profiles'

export type Person = Pick<Profile, 'id' | 'username' | 'display_name' | 'avatar_url'>

/**
 * Busca personas por nombre o @usuario. Cualquier cuenta con usuario aparece, también las de diarios privados:
 * así se puede solicitar seguirlas. No devuelve a quien busca.
 */
export function usePeopleSearch(text: string) {
  const me = useMe()
  const q = useDebounced(text.trim().replace(/^@/, '').replace(/[%,()*\\]/g, ' ').trim())
  const { data, isFetching } = useQuery({
    queryKey: ['people', q],
    enabled: q.length >= 2,
    queryFn: async (): Promise<Person[]> => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url')
        .not('username', 'is', null)
        .neq('id', me.id)
        .or(`username.ilike.%${q}%,display_name.ilike.%${q}%`)
        .limit(8)
      if (error) throw error
      return data
    },
  })
  return { q, people: data, isFetching }
}
