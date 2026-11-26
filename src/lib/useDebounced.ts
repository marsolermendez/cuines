import { useEffect, useState } from 'react'

/** El valor, pero solo una vez que deja de cambiar durante `ms`: para no lanzar una consulta por tecla. */
export function useDebounced<T>(value: T, ms = 300): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return debounced
}
