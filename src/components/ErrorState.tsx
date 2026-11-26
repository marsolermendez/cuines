import { btnSecondary } from './ui'

/** Un error de carga con salida: reintentar la consulta. */
export default function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="rounded-xl border border-line bg-paper p-6 text-center">
      <p>{message}</p>
      {onRetry && (
        <button className={`${btnSecondary} mt-3`} onClick={onRetry}>
          Reintentar
        </button>
      )}
    </div>
  )
}
