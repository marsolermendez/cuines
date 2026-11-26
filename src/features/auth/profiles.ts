import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import type { Profile, ProfileUpdate } from '../../lib/types'
import { useSession } from './AuthProvider'

export function useMyProfile() {
  const uid = useSession().session?.user.id
  return useQuery({
    queryKey: ['profile', 'me', uid],
    enabled: !!uid,
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', uid!).single()
      if (error) throw error
      return data
    },
  })
}

/** Mi perfil dentro de rutas protegidas: RequireAuth garantiza que ya está cargado. */
export const useMe = () => useMyProfile().data as Profile

export function useProfileByUsername(username: string | undefined) {
  return useQuery({
    queryKey: ['profile', 'u', username],
    enabled: !!username,
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('*').eq('username', username!).maybeSingle()
      if (error) throw error
      return data
    },
  })
}

export function useUpdateProfile() {
  const queryClient = useQueryClient()
  const uid = useSession().session?.user.id
  return useMutation({
    mutationFn: async (patch: ProfileUpdate) => {
      const { data, error } = await supabase.from('profiles').update(patch).eq('id', uid!).select().single()
      if (error) throw error
      return data
    },
    // Pasar a público acepta las solicitudes pendientes en el servidor: se refresca también lo social.
    onSuccess: () => Promise.all([queryClient.invalidateQueries({ queryKey: ['profile'] }), queryClient.invalidateQueries({ queryKey: ['diary'] })]),
  })
}
