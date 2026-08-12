import { useState } from 'react'
import { Check } from 'lucide-react'
import { gradientFor } from '../theme/gradient'

interface CoverTileProps {
  title: string
  /** Jaquette réelle (Jikan/Google Books/Open Library), si une correspondance
   * a été trouvée lors de l'ajout. Absente pour un ajout en saisie libre, ou
   * si la recherche de métadonnées n'a rien renvoyé - le dégradé reste alors
   * le repli, jamais une image cassée. */
  imageUrl?: string | null
  showBadge?: boolean
  /** Ligne secondaire sous le titre (ex: "17/26 tomes · En cours" en vue
   * groupée par série sur Ma collection) - absente par défaut, n'affecte
   * pas les autres usages de ce composant (Wishlist, Relations). */
  subtitle?: string
  /** ex: "aspect-[2/3]" (défaut) ou "aspect-square" pour les listes horizontales. */
  aspectClassName?: string
  /** Clé utilisée pour le dégradé de repli (voir gradientFor) - `title` par
   * défaut. À surcharger quand plusieurs tuiles partagent le même titre mais
   * doivent rester visuellement distinctes sans jaquette réelle (ex: les
   * tomes d'une même série sur Ma collection - voir ShelfPage.flattenToTomes,
   * qui y ajoute le sous-titre "Tome N" pour ne pas afficher le même
   * dégradé sur chaque tome faute de jaquette propre au tome). */
  gradientKey?: string
  onClick?: () => void
}

/**
 * Jaquette réelle quand une source externe en a fourni une (Jikan / Google
 * Books via scan ISBN / Open Library), avec le dégradé déterministe (calculé
 * depuis le titre) comme repli - saisie libre, échec de recherche, ou simple
 * échec de chargement de l'image. Miroir de CoverTile.swift.
 */
export function CoverTile({
  title,
  imageUrl,
  showBadge = false,
  subtitle,
  aspectClassName = 'aspect-[2/3]',
  gradientKey,
  onClick,
}: CoverTileProps) {
  const [imageFailed, setImageFailed] = useState(false)
  const showImage = !!imageUrl && !imageFailed

  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative w-full overflow-hidden rounded-2xl text-left ${aspectClassName} ${onClick ? 'cursor-pointer' : 'cursor-default'}`}
      style={showImage ? undefined : { background: gradientFor(gradientKey ?? title) }}
    >
      {showImage && (
        <img
          src={imageUrl}
          alt=""
          onError={() => setImageFailed(true)}
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}
      <div
        className="absolute inset-x-0 bottom-0 h-2/3"
        style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.75), transparent)' }}
      />
      {showBadge && (
        <span className="absolute top-2 right-2 flex h-6 w-6 items-center justify-center rounded-full bg-accent text-accent-text">
          <Check size={14} strokeWidth={3} />
        </span>
      )}
      <span className="absolute bottom-2 left-2 right-2 flex flex-col gap-0.5">
        <span className="line-clamp-2 font-display text-sm font-medium text-textPrimary">{title}</span>
        {subtitle && <span className="text-xs text-textDim">{subtitle}</span>}
      </span>
    </button>
  )
}
