import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { dayString, formatDay, formatMonth, isMonth, parseMonth, shiftMonth, today } from '../../lib/dates'
import { useDiaryMonth } from './queries'

const WEEKDAYS = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom']
const nav = 'rounded-lg p-2 text-ink-soft hover:bg-line'

/** Calendario mensual (semana de lunes a domingo): los días con entradas salen resaltados. Qué días ves lo decide la RLS. */
export default function Calendar({ authorId }: { authorId: string }) {
  const [params, setParams] = useSearchParams()
  const raw = params.get('m')
  const todayStr = today()
  const month = isMonth(raw) ? raw : todayStr.slice(0, 7)
  const [selected, setSelected] = useState<string | null>(null)
  const { data = [], isPending, isError } = useDiaryMonth(authorId, month)

  const byDay = new Map<string, typeof data>()
  for (const e of data) byDay.set(e.cooked_on, [...(byDay.get(e.cooked_on) ?? []), e])

  const [y, m] = parseMonth(month)
  const lead = (new Date(y, m - 1, 1).getDay() + 6) % 7
  const daysInMonth = new Date(y, m, 0).getDate()

  function go(delta: number) {
    setSelected(null)
    setParams({ m: shiftMonth(month, delta) }, { replace: true })
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <button className={nav} onClick={() => go(-1)} aria-label="Mes anterior">
          <ChevronLeft className="size-5" />
        </button>
        <h3 className="font-serif text-lg font-medium" aria-live="polite">
          {formatMonth(month)}
        </h3>
        <button className={nav} onClick={() => go(1)} aria-label="Mes siguiente">
          <ChevronRight className="size-5" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-xs text-ink-soft">
        {WEEKDAYS.map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {Array.from({ length: lead }, (_, i) => (
          <span key={`b${i}`} />
        ))}
        {Array.from({ length: daysInMonth }, (_, i) => {
          const day = dayString(y, m, i + 1)
          const items = byDay.get(day)
          const base = `relative flex aspect-square items-center justify-center rounded-full text-sm ${day === todayStr ? 'ring-1 ring-ink-soft ring-inset' : ''}`
          return items ? (
            <button
              key={day}
              onClick={() => setSelected(selected === day ? null : day)}
              aria-pressed={selected === day}
              aria-label={`${formatDay(day)}: ${items.length} ${items.length === 1 ? 'entrada' : 'entradas'}`}
              className={`${base} bg-clay font-medium text-on-clay ${selected === day ? 'outline-2 outline-offset-2 outline-clay-soft' : ''}`}
            >
              {i + 1}
              {items.length > 1 && (
                <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full border border-clay bg-paper text-[11px] font-medium text-clay">
                  {items.length}
                </span>
              )}
            </button>
          ) : (
            <span key={day} className={base}>
              {i + 1}
            </span>
          )
        })}
      </div>

      {isPending && <p className="mt-4 text-sm text-ink-soft">Cargando…</p>}
      {isError && <p className="mt-4 text-sm">No se pudo cargar el mes.</p>}
      {!isPending && !isError && data.length === 0 && <p className="mt-4 text-sm text-ink-soft">Sin entradas este mes.</p>}

      {selected && (
        <section className="mt-6">
          <h4 className="text-sm text-ink-soft">{formatDay(selected)}</h4>
          <ul className="mt-2 grid gap-2">
            {byDay.get(selected)?.map((e) => (
              <li key={e.id}>
                <Link to={`/e/${e.id}`} className="block rounded-lg border border-line bg-paper px-4 py-3 font-serif text-lg hover:shadow-sm">
                  {e.title}
                  {e.shared && <span className="mt-0.5 block font-sans text-xs text-ink-soft">con {e.author_display_name}</span>}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
