import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useSession } from '../auth/AuthProvider'

/** Entradas en las que me han etiquetado («cocinado con…») y aún no he aceptado. */
export function useParticipationRequests() {
  const uid = useSession().session?.user.id
  return useQuery({
    queryKey: ['diary', 'participation', uid],
    enabled: !!uid,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('entry_participants')
        .select('entry_id, created_at, entries(id, title, profiles!entries_author_id_fkey(username, display_name))')
        .eq('user_id', uid!)
        .eq('status', 'pending')
        .order('created_at')
      if (error) throw error
      return data
    },
  })
}

/** Aceptar una etiqueta (la entrada pasa a mi diario) o rechazarla / salirme de ella (borrar la fila). */
export function useAnswerParticipation() {
  const queryClient = useQueryClient()
  const uid = useSession().session?.user.id
  return useMutation({
    mutationFn: async ({ entryId, accept }: { entryId: string; accept: boolean }) => {
      const base = supabase.from('entry_participants')
      const { error } = accept
        ? await base.update({ status: 'accepted' }).eq('entry_id', entryId).eq('user_id', uid!)
        : await base.delete().eq('entry_id', entryId).eq('user_id', uid!)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['diary'] }),
  })
}
