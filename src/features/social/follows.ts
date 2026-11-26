import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useSession } from '../auth/AuthProvider'

// Todo cuelga de ['diary', ...]: seguir, dejar de seguir o aceptar cambia lo que se puede leer, así que un solo
// invalidateQueries refresca feed, diarios y calendarios.

export type FollowStatus = 'pending' | 'accepted'

/** Mi seguimiento hacia otra persona: `null` si no la sigo, 'pending' si espera su aprobación. */
export function useFollowStatus(targetId: string | undefined) {
  const uid = useSession().session?.user.id
  return useQuery({
    queryKey: ['diary', 'follow', uid, targetId],
    enabled: !!uid && !!targetId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('follows')
        .select('status')
        .eq('follower_id', uid!)
        .eq('followee_id', targetId!)
        .maybeSingle()
      if (error) throw error
      return (data?.status as FollowStatus | undefined) ?? null
    },
  })
}

/** A quién sigo y quién me sigue (solo solicitudes aceptadas). Una sola consulta: la RLS de `follows` solo deja ver
 *  las filas donde participo, así que todo lo que vuelve ya es mío y solo hay que separar las dos direcciones. */
export function useMyConnections() {
  const uid = useSession().session?.user.id
  return useQuery({
    queryKey: ['diary', 'connections', uid],
    enabled: !!uid,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('follows')
        .select(
          'follower_id, followee_id, follower:profiles!follows_follower_id_fkey(id, username, display_name, avatar_url), followee:profiles!follows_followee_id_fkey(id, username, display_name, avatar_url)',
        )
        .eq('status', 'accepted')
        .order('created_at', { ascending: false })
      if (error) throw error
      return {
        following: data.filter((f) => f.follower_id === uid).flatMap((f) => (f.followee ? [f.followee] : [])),
        followers: data.filter((f) => f.followee_id === uid).flatMap((f) => (f.follower ? [f.follower] : [])),
      }
    },
  })
}

/** Seguir (o solicitar seguir) y dejar de seguir (o cancelar la solicitud). El servidor decide el estado. */
export function useToggleFollow(targetId: string) {
  const queryClient = useQueryClient()
  const uid = useSession().session?.user.id
  return useMutation({
    mutationFn: async (following: boolean) => {
      const { error } = following
        ? await supabase.from('follows').delete().eq('follower_id', uid!).eq('followee_id', targetId)
        : await supabase.from('follows').insert({ follower_id: uid!, followee_id: targetId })
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['diary'] }),
  })
}

/** Solicitudes pendientes de personas que quieren seguirme: toda solicitud espera mi aprobación. */
export function useFollowRequests() {
  const uid = useSession().session?.user.id
  return useQuery({
    queryKey: ['diary', 'requests', uid],
    enabled: !!uid,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('follows')
        .select('follower_id, created_at, follower:profiles!follows_follower_id_fkey(id, username, display_name, avatar_url)')
        .eq('followee_id', uid!)
        .eq('status', 'pending')
        .order('created_at')
      if (error) throw error
      return data
    },
  })
}

/** Aceptar una solicitud (UPDATE a 'accepted') o rechazarla (borrarla). */
export function useAnswerRequest() {
  const queryClient = useQueryClient()
  const uid = useSession().session?.user.id
  return useMutation({
    mutationFn: async ({ followerId, accept }: { followerId: string; accept: boolean }) => {
      const base = supabase.from('follows')
      const { error } = accept
        ? await base.update({ status: 'accepted' }).eq('follower_id', followerId).eq('followee_id', uid!)
        : await base.delete().eq('follower_id', followerId).eq('followee_id', uid!)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['diary'] }),
  })
}
