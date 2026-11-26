import { Link } from 'react-router-dom'
import { useTitle } from '../lib/useTitle'
import { btnPrimary } from './ui'

export default function NotFound() {
  useTitle('Página no encontrada')
  return (
    <div className="rounded-xl border border-dashed border-line p-8 text-center">
      <p className="font-serif text-2xl">No encontramos esa página</p>
      <p className="mt-1 text-ink-soft">Puede que el enlace esté mal o que ya no exista.</p>
      <Link to="/" className={`${btnPrimary} mt-4`}>
        Ir al inicio
      </Link>
    </div>
  )
}
