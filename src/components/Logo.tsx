/** Marca de Cuines: olla con llamas + nombre. El texto sigue siendo «Cuines» para lectores de pantalla; se ve en minúsculas. */
export default function Logo({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-[0.3em] font-semibold lowercase tracking-[-0.04em] ${className}`}>
      <svg viewBox="6 15 52 48" className="h-[1.4em] w-auto" aria-hidden="true">
        <g fill="currentColor">
          <rect x="14" y="28" width="36" height="20" rx="7" />
          <circle cx="32" cy="20.5" r="3.2" />
          <rect x="8" y="33" width="8" height="5" rx="2.5" />
          <rect x="48" y="33" width="8" height="5" rx="2.5" />
        </g>
        <path d="M12 28C12 19 52 19 52 28Z" className="fill-clay" />
        <path
          d="M32 51C36 54.5 38 58.5 32 62C26 58.5 28 54.5 32 51ZM21 52C24 55 25 58 21 60.5C17 58 18 55 21 52ZM43 52C46 55 47 58 43 60.5C39 58 40 55 43 52Z"
          fill="#f6d58e"
        />
      </svg>
      Cuines
    </span>
  )
}
