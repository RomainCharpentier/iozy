import { Link, useNavigate } from 'react-router-dom'
import { Heart } from 'lucide-react'
import { useWishlist } from '../../lib/useWishlist'

/**
 * Les deux accès globaux qui ne sont PAS des destinations de navigation :
 * Envies (cœur, avec badge) et Profil (avatar). Voir la maquette V1.2 -
 * « Trois intentions, trois espaces. Tout le reste vit dans l'espace auquel il
 * appartient : Envies au cœur, Profil à l'avatar ».
 * <p>
 * Extrait de DesktopHeader pour être partagé avec MobileHeader : ces deux
 * raccourcis n'existaient que sur desktop, ce qui rendait `/wishlist` et
 * `/profile` - et donc Paramètres, Administration, l'export, le bilan annuel et
 * les deux partages - **totalement inatteignables en dessous de 768 px** (voir
 * docs/USER_JOURNEYS.md §12.1). Un seul composant pour les deux en-têtes, pour
 * qu'ils ne puissent plus diverger.
 */
export function GlobalShortcuts({ compact = false }: { compact?: boolean }) {
  const navigate = useNavigate()
  const { count } = useWishlist()
  const size = compact ? 'h-10 w-10' : 'h-11 w-11'
  const avatarSize = compact ? 'h-9 w-9' : 'h-[38px] w-[38px]'

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => navigate('/wishlist')}
        title="Mes envies"
        aria-label={count > 0 ? `Mes envies, ${count}` : 'Mes envies'}
        className={`relative flex ${size} items-center justify-center rounded-xl text-textDim transition-colors hover:bg-rowHover hover:text-textPrimary`}
      >
        <Heart size={20} />
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-[19px] min-w-[19px] items-center justify-center rounded-full bg-accent px-1 text-[11px] font-bold text-accentInk">
            {count}
          </span>
        )}
      </button>
      <Link
        to="/profile"
        title="Mon profil"
        aria-label="Mon profil"
        className={`flex ${avatarSize} shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-surface2 to-accentTint font-display text-xs font-bold text-textPrimary`}
      >
        IO
      </Link>
    </div>
  )
}
