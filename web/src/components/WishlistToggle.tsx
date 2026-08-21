import { Heart, HeartOff } from 'lucide-react'
import { useWishlist } from '../lib/useWishlist'

/**
 * Le seul bouton « Envies » de l'application - même état, même libellé et même
 * retour visuel partout (fiche d'une œuvre, résultat de recherche déjà possédé,
 * menu du scan). Toute la logique vit dans useWishlist.
 *
 * Deux tailles : `inline` pour une ligne de liste, où le bouton ne doit pas
 * peser plus que le titre à côté duquel il vit ; `default` pour une fiche, où
 * c'est une action à part entière.
 */
export function WishlistToggle({
  entityId,
  variant = 'default',
}: {
  entityId: string
  variant?: 'default' | 'inline'
}) {
  const wishlist = useWishlist()
  const entry = wishlist.entryFor(entityId)
  const dedans = !!entry

  const base = 'flex items-center gap-1.5 font-semibold transition-colors disabled:opacity-50'
  const taille =
    variant === 'inline'
      ? 'rounded-lg px-2 py-1 text-xs'
      : 'min-h-10 rounded-xl px-3 text-sm'
  const couleur = dedans
    ? 'bg-accentTint text-accentText hover:bg-accent/25'
    : 'text-textDim hover:bg-rowHover hover:text-textPrimary'

  return (
    <button
      type="button"
      disabled={wishlist.isPending}
      onClick={(e) => {
        // Ces boutons vivent souvent DANS une ligne cliquable (résultat de
        // recherche, menu du scan) : sans ça, le clic ouvrirait aussi la fiche.
        e.stopPropagation()
        if (entry) wishlist.remove(entry.id, entityId)
        else wishlist.add(entityId)
      }}
      // Le libellé visible dit l'ÉTAT ; le nom accessible dit l'ACTION, sans
      // quoi un lecteur d'écran annonce « Dans vos envies » sur un bouton qui,
      // lui, retire.
      aria-label={dedans ? 'Retirer de mes envies' : 'Ajouter à mes envies'}
      className={`${base} ${taille} ${couleur}`}
    >
      {dedans ? <HeartOff size={variant === 'inline' ? 13 : 16} /> : <Heart size={variant === 'inline' ? 13 : 16} />}
      {dedans ? 'Dans vos envies' : 'Ajouter aux envies'}
    </button>
  )
}
