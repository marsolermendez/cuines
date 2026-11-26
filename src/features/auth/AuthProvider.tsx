import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'

type AuthState = { session: Session | null; loading: boolean }

const AuthContext = createContext<AuthState>({ session: null, loading: true })

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ session: null, loading: true })
  const queryClient = useQueryClient()
  const userId = useRef<string | undefined>(undefined)

  useEffect(() => {
    const apply = (session: Session | null) => {
      const id = session?.user.id
      // La caché no distingue quién mira: si cambia la persona (cerrar sesión o entrar con otra cuenta en la
      // misma pestaña) se vacía, para no enseñarle lo que la anterior dejó en memoria.
      if (userId.current !== undefined && id !== userId.current) queryClient.clear()
      userId.current = id
      setState({ session, loading: false })
    }
    // getSession espera a que termine el intercambio del código PKCE tras volver de Google.
    supabase.auth.getSession().then(({ data }) => apply(data.session))
    const { data } = supabase.auth.onAuthStateChange((_event, session) => apply(session))
    return () => data.subscription.unsubscribe()
  }, [queryClient])

  return <AuthContext value={state}>{children}</AuthContext>
}

export const useSession = () => useContext(AuthContext)
