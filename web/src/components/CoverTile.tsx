import { Check } from 'lucide-react'
import { gradientFor } from '../theme/gradient'

interface CoverTileProps {
  title: string
  showBadge?: boolean
  /** ex: "aspect-[2/3]" (défaut) ou "aspect-square" pour les listes horizontales. */
  aspectClassName?: string
  onClick?: () => void
}

/**
 * Pas d'images de couverture réelles (droits non disponibles) - un dégradé
 * déterministe (calculé depuis le titre) fait office de "couverture", avec
 * un fondu sombre en bas pour la lisibilité du titre. Miroir de CoverTile.swift.
 */
export function CoverTile({ title, showBadge = false, aspectClassName = 'aspect-[2/3]', onClick }: CoverTileProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative w-full overflow-hidden rounded-2xl text-left ${aspectClassName} ${onClick ? 'cursor-pointer' : 'cursor-default'}`}
      style={{ background: gradientFor(title) }}
    >
      <div
        className="absolute inset-x-0 bottom-0 h-2/3"
        style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.75), transparent)' }}
      />
      {showBadge && (
        <span className="absolute top-2 right-2 flex h-6 w-6 items-center justify-center rounded-full bg-accent text-accent-text">
          <Check size={14} strokeWidth={3} />
        </span>
      )}
      <span className="absolute bottom-2 left-2 right-2 line-clamp-2 font-display text-sm font-medium text-textPrimary">
        {title}
      </span>
    </button>
  )
}
