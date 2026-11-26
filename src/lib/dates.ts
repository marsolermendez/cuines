// `cooked_on` es una fecha sin zona horaria ('YYYY-MM-DD'). Nunca se pasa a `new Date(string)`: se interpretaría
// como UTC y en zonas al oeste de Greenwich saldría el día anterior. Aquí se trocea la cadena y se construye en local.

const pad = (n: number) => String(n).padStart(2, '0')

export const dayString = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`
export const monthString = (y: number, m: number) => `${y}-${pad(m)}`

export function today(): string {
  const n = new Date()
  return dayString(n.getFullYear(), n.getMonth() + 1, n.getDate())
}

export const parseMonth = (month: string): [number, number] => {
  const [y, m] = month.split('-').map(Number)
  return [y!, m!]
}

export const isMonth = (s: string | null): s is string => !!s && /^\d{4}-(0[1-9]|1[0-2])$/.test(s)

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = parseMonth(month)
  const d = new Date(y, m - 1 + delta, 1)
  return monthString(d.getFullYear(), d.getMonth() + 1)
}

/** Primer y último día del mes, para filtrar por rango. */
export function monthBounds(month: string): { first: string; last: string } {
  const [y, m] = parseMonth(month)
  return { first: dayString(y, m, 1), last: dayString(y, m, new Date(y, m, 0).getDate()) }
}

// Intl devuelve 'noviembre de 2026': solo la inicial en mayúscula (CSS `capitalize` pondría también 'De').
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

const localDate = (day: string) => {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(y!, m! - 1, d)
}

export const formatMonth = (month: string) => {
  const [y, m] = parseMonth(month)
  return cap(new Intl.DateTimeFormat('es', { month: 'long', year: 'numeric' }).format(new Date(y, m - 1, 1)))
}

export const formatDay = (day: string, opts: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'long' }) =>
  cap(new Intl.DateTimeFormat('es', opts).format(localDate(day)))

/** Un instante real (timestamptz), no una fecha de calendario: aquí sí se puede usar `new Date(string)`. */
export const formatWhen = (iso: string) =>
  new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(iso))
