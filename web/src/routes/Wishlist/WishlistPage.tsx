import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { X } from 'lucide-react'
import { listWishlist } from '../../api/wishlist'
import { getEntity } from '../../api/entities'
import { listEntityTypes } from '../../api/entityTypes'
import { queryKeys } from '../../lib/queryKeys'
import { useWishlist } from '../../lib/useWishlist'
import { ErrorBanner } from '../../components/ErrorBanner'
import { CoverTile } from '../../components/CoverTile'
import { coverImageUrlFrom } from '../../lib/coverImage'
import { totalVolumesFrom } from '../../lib/seriesInfo'
import { ShareSection } from '../Share/ShareSection'
import type { EntityTypeDto, WishlistEntryResponse } from '../../types/api'

/** "72 tomes" si connu (manga dont Jikan/MyAnimeList a fourni un total) -
 * jamais "Possédé" ici, contrairement à ShelfPage : un souhait de wishlist
 * n'est par définition pas possédé. Le type vit dans son propre badge (voir
 * CoverTile.typeLabel), cette fonction ne gère plus que le sous-titre. */
function wishlistTileSubtitle(attributes: Record<string, unknown>): string | undefined {
  const total = totalVolumesFrom(attributes)
  return total !== null ? `${total} tome${total > 1 ? 's' : ''}` : undefined
}

/** Jointure client-side vers le titre de l'entité - pas de dénormalisation
 * côté backend (WishlistEntryResponse reste {id, entityId, addedAt}, cohérent
 * avec les autres DTOs de liste du projet, aucun ne dénormalise). Souvent
 * déjà en cache TanStack Query depuis Shelf/Search, donc pas de requête
 * réseau supplémentaire dans ce cas. */
function WishlistRow({ entry, entityTypesById }: { entry: WishlistEntryResponse; entityTypesById: Map<string, EntityTypeDto> }) {
  const navigate = useNavigate()
  // Passe par le hook partagé : même invalidation et même retour visuel
  // (« Retiré des envies » + Annuler) que depuis la fiche, la recherche ou le
  // scan - au lieu d'une mutation propre à cet écran, qui divergeait déjà.
  const wishlist = useWishlist()
  const entityQuery = useQuery({
    queryKey: queryKeys.entities.detail(entry.entityId),
    queryFn: () => getEntity(entry.entityId),
  })

  if (!entityQuery.data) return null

  return (
    <li className="relative">
      <CoverTile
        title={entityQuery.data.title}
        subtitle={wishlistTileSubtitle(entityQuery.data.attributes)}
        typeLabel={entityTypesById.get(entityQuery.data.entityTypeId)?.label}
        imageUrl={coverImageUrlFrom(entityQuery.data.attributes)}
        onClick={() => navigate(`/entity/${entry.entityId}`)}
      />
      {/* Action secondaire et discrète, jamais un gros bouton permanent :
          une icône seule dans un coin libre de CoverTile (showBadge n'est pas
          utilisé ici). Retire directement au clic, sans confirmation ni menu
          intermédiaire - une wishlist reste une liste d'envies à faible
          enjeu, ré-ajouter ne coûte qu'un clic depuis Recherche, contrairement
          à "Supprimer cette fiche" qui, elle, est irréversible (voir
          DeleteEntitySection). stopPropagation : évite de déclencher aussi le
          clic de CoverTile (navigation vers la fiche) en dessous. */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          wishlist.remove(entry.id, entry.entityId)
        }}
        disabled={wishlist.isPending}
        aria-label={`Retirer ${entityQuery.data.title} de la wishlist`}
        title="Retirer de la wishlist"
        className="absolute top-1.5 right-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/70 text-textPrimary transition hover:bg-black/85 disabled:opacity-50"
      >
        <X size={13} strokeWidth={2.5} />
      </button>
    </li>
  )
}

export function WishlistPage() {
  const wishlistQuery = useQuery({ queryKey: queryKeys.wishlist.all, queryFn: listWishlist })
  const entityTypesQuery = useQuery({ queryKey: queryKeys.entityTypes.all, queryFn: listEntityTypes })
  const entityTypesById = new Map((entityTypesQuery.data ?? []).map((t) => [t.id, t]))

  const sorted = [...(wishlistQuery.data ?? [])].sort((a, b) => b.addedAt.localeCompare(a.addedAt))

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-display text-2xl font-bold text-textPrimary">Wishlist</h1>

      <ShareSection miseEnAvant="wishlist" />

      {wishlistQuery.isError && <ErrorBanner message={wishlistQuery.error.message} />}
      {wishlistQuery.isLoading && <p className="text-textDim">Chargement...</p>}

      {wishlistQuery.isSuccess && sorted.length === 0 && (
        <p className="text-textDim">
          Rien dans ta wishlist - depuis l'onglet Recherche, "Vérifier" puis "Ajouter à la wishlist" sur un titre.
        </p>
      )}

      {/* Même densité que Ma Collection (même composant CoverTile, même
          logique de lisibilité - audit UX "jaquettes trop petites") : plus de
          colonnes fixes ni de largeur figée sur chaque <li> (l'ancien `w-28
          shrink-0` était un reliquat d'une mise en page flex antérieure à ce
          grid - il empêchait CoverTile de remplir sa colonne et laissait un
          espace mort à droite de chaque tuile). */}
      <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-5">
        {sorted.map((entry) => (
          <WishlistRow key={entry.id} entry={entry} entityTypesById={entityTypesById} />
        ))}
      </ul>
    </div>
  )
}
