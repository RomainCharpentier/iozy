import { useState } from 'react'
import { Heart, HeartOff } from 'lucide-react'
import { useWishlist } from '../lib/useWishlist'
import type { WishlistTarget } from '../api/wishlist'

/**
 * Le seul bouton « Envies » de l'application - même état, même libellé et même
 * retour visuel partout (fiche d'une œuvre, résultat de recherche local ou
 * externe, menu du scan). Toute la logique vit dans useWishlist.
 *
 * Le bouton accepte les deux natures d'œuvre :
 * - `entityId` : l'œuvre a déjà une fiche IozyCore ;
 * - `external` : elle vient d'une source externe et n'en a pas encore. Le
 *   backend résout ou crée sa fiche à l'ajout et renvoie son identité interne,
 *   qu'on retient ici pour pouvoir ensuite afficher l'état réel et proposer le
 *   retrait. Aucune possession n'est créée : vouloir n'est pas posséder.
 *
 * Deux tailles : `inline` pour une ligne de liste, où le bouton ne doit pas
 * peser plus que le titre à côté duquel il vit ; `default` pour une fiche, où
 * c'est une action à part entière.
 */
export function WishlistToggle({
  entityId,
  external,
  variant = 'default',
}: {
  entityId?: string
  external?: { entityTypeId: string; title: string; attributes?: Record<string, unknown> }
  variant?: 'default' | 'inline'
}) {
  const wishlist = useWishlist()
  // Identité interne apprise en ajoutant une œuvre externe. Tant qu'elle est
  // inconnue, le bouton ne peut pas savoir si l'œuvre est en envies - ce qui
  // est exact : une œuvre sans fiche ne peut pas y être.
  const [resoluEntityId, setResoluEntityId] = useState<string | undefined>()
  const idConnu = entityId ?? resoluEntityId
  const entry = idConnu ? wishlist.entryFor(idConnu) : undefined
  const dedans = !!entry

  const base = 'flex items-center gap-1.5 font-semibold transition-colors disabled:opacity-50'
  const taille =
    variant === 'inline'
      ? 'rounded-lg px-2 py-1 text-xs'
      : 'min-h-12 rounded-[14px] px-4 text-sm'
  // Hors d'une ligne de liste, c'est une VRAIE action secondaire, avec sa
  // propre surface (maquette v4) : posé nu à côté d'un bouton plein, il ne se
  // lisait plus comme un bouton du tout - juste comme du texte gris.
  const couleur = dedans
    ? 'bg-accentTint text-accentText hover:bg-accent/25'
    : variant === 'inline'
      ? 'text-textDim hover:bg-rowHover hover:text-textPrimary'
      : 'bg-softBtn text-textPrimary hover:bg-softPress'

  async function basculer() {
    if (entry && idConnu) {
      wishlist.remove(entry.id, idConnu)
      return
    }
    const cible: WishlistTarget | undefined = entityId
      ? { entityId }
      : resoluEntityId
        ? { entityId: resoluEntityId }
        : external
    if (!cible) return
    const creee = await wishlist.addAsync(cible)
    setResoluEntityId(creee.entityId)
  }

  return (
    <button
      type="button"
      disabled={wishlist.isPending || (!entityId && !external && !resoluEntityId)}
      onClick={(e) => {
        // Ces boutons vivent souvent DANS une ligne cliquable (résultat de
        // recherche, menu du scan) : sans ça, le clic ouvrirait aussi la fiche.
        e.stopPropagation()
        void basculer()
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
