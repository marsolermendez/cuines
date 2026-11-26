import { Component, type ErrorInfo, type ReactNode } from 'react'

type State = { error: Error | null }

/**
 * Última red: si algo revienta al pintar, en vez de una pantalla en blanco se explica y se ofrece recargar.
 * Caso típico en GitHub Pages: tras publicar una versión nueva, la pestaña abierta pide un archivo con nombre
 * antiguo que ya no existe y falla al cargar una pantalla.
 */
export default class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error, info.componentStack)
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children
    const stale = /dynamically imported module|Importing a module script failed|Loading chunk/i.test(error.message)
    return (
      <div role="alert" className="mx-auto grid min-h-screen max-w-md place-content-center gap-3 px-4 text-center">
        <h1 className="font-serif text-2xl font-medium">{stale ? 'Hay una versión nueva' : 'Algo ha fallado'}</h1>
        <p className="text-ink-soft">
          {stale ? 'Se ha publicado una actualización. Recarga la página para continuar.' : 'No hemos podido mostrar esta pantalla. Recarga la página; si sigue igual, vuelve más tarde.'}
        </p>
        <button className="mx-auto inline-flex rounded-lg bg-clay px-4 py-2 text-sm font-medium text-white hover:bg-clay-dark" onClick={() => window.location.reload()}>
          Recargar
        </button>
      </div>
    )
  }
}
