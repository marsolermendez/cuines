import { useState } from 'react'

type Props = {
  /** URL de la foto; hasta que llegue (o cargue) se ve el placeholder desenfocado. */
  src?: string
  placeholder: string
  width: number
  height: number
  alt: string
  /** Limita la proporción (de 4:5 a 16:9) para que una foto muy alta o muy ancha no domine la tarjeta. */
  crop?: boolean
  /** Proporción fija (ancho / alto): recorta la foto. Para mosaicos uniformes. */
  ratio?: number
  eager?: boolean
  className?: string
}

export default function ProgressiveImage({ src, placeholder, width, height, alt, crop, ratio: fixed, eager, className = '' }: Props) {
  const [loaded, setLoaded] = useState(false)
  const ratio = fixed ?? (crop ? Math.min(Math.max(width / height, 0.8), 16 / 9) : width / height)
  return (
    <div className={`relative overflow-hidden bg-line ${className}`} style={{ aspectRatio: ratio }}>
      <img src={placeholder} alt="" aria-hidden="true" className="absolute inset-0 size-full scale-110 object-cover blur-xl" />
      {src && (
        <img
          src={src}
          alt={alt}
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
          onLoad={() => setLoaded(true)}
          className={`absolute inset-0 size-full object-cover transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
        />
      )}
    </div>
  )
}
