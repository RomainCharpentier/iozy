import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { listWishlist } from '../../api/wishlist'
import { getEntity } from '../../api/entities'
import { queryKeys } from '../../lib/queryKeys'
import { ErrorBanner } from '../../components/ErrorBanner'
import { CoverTile } from '../../components/CoverTile'
import { coverImageUrlFrom } from '../../lib/coverImage'
import { WishlistShareSection } from './WishlistShareSection'
import type { WishlistEntryResponse } from '../../types/api'

/** Jointure client-side vers le titre de l'entité - pas de dénormalisation
 * côté backend (WishlistEntryResponse reste {id, entityId, addedAt}, cohérent
 * avec les autres DTOs de liste du projet, aucun ne dénormalise). Souvent
 * déjà en cache TanStack Query depuis Shelf/Search, donc pas de requête
 * réseau supplémentaire dans ce cas. */
function WishlistRow({ entry }: { entry: WishlistEntryResponse }) {
  const navigate = useNavigate()
  const entityQuery = useQuery({
    queryKey: queryKeys.entities.detail(entry.entityId),
    queryFn: () => getEntity(entry.entityId),
  })

  if (!entityQuery.data) return null

  return (
    <li>
      <CoverTile
        title={entityQuery.data.title}
        imageUrl={coverImageUrlFrom(entityQuery.data.attributes)}
        onClick={() => navigate(`/entity/${entry.entityId}`)}
      />
    </li>
  )
}

export function WishlistPage() {
  const wishlistQuery = useQuery({ queryKey: queryKeys.wishlist.all, queryFn: listWishlist })

  const sorted = [...(wishlistQuery.data ?? [])].sort((a, b) => b.addedAt.localeCompare(a.addedAt))

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-display text-2xl font-bold text-textPrimary">Wishlist</h1>

      <WishlistShareSection />

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
          <WishlistRow key={entry.id} entry={entry} />
        ))}
      </ul>
    </div>
  )
}
