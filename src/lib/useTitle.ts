import { useEffect } from 'react'

/** Título de la pestaña por pantalla (también lo anuncian los lectores de pantalla al navegar). */
export function useTitle(title: string | null | undefined) {
  useEffect(() => {
    document.title = title ? `${title} · Cuines` : 'Cuines'
    return () => {
      document.title = 'Cuines'
    }
  }, [title])
}
