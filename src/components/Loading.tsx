function Block({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-line ${className}`} />
}

export function CardSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-paper" aria-hidden="true">
      <div className="aspect-[4/3] animate-pulse bg-line" />
      <div className="grid gap-2 p-4">
        <Block className="h-3 w-24" />
        <Block className="h-5 w-2/3" />
        <Block className="h-3 w-full" />
        <Block className="h-3 w-5/6" />
      </div>
    </div>
  )
}

/** Marcador de carga de una pantalla: tarjetas grises donde irán las reales (sin saltos de diseño). */
export default function Loading({ cards = 2 }: { cards?: number }) {
  return (
    <div role="status" aria-live="polite" className="grid gap-4">
      <span className="sr-only">Cargando…</span>
      {Array.from({ length: cards }, (_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  )
}
