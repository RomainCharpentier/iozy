import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { X } from 'lucide-react'
import { listWishlist, removeFromWishlist } from '../../api/wishlist'
import { getEntity } from '../../api/entities'
import { listEntityTypes } from '../../api/entityTypes'
import { queryKeys } from '../../lib/queryKeys'
import { ErrorBanner } from '../../components/ErrorBanner'
import { CoverTile } from '../../components/CoverTile'
import { coverImageUrlFrom } from '../../lib/coverImage'
import { totalVolumesFrom } from '../../lib/seriesInfo'
import { WishlistShareSection } from './WishlistShareSection'
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
  const queryClient = useQueryClient()
  const entityQuery = useQuery({
    queryKey: queryKeys.entities.detail(entry.entityId),
    queryFn: () => getEntity(entry.entityId),
  })

  const removeMutation = useMutation({
    mutationFn: () => removeFromWishlist(entry.id),
    onSuccess: () => {
      // Retire directement cette entrée du cache plutôt que d'invalider la
      // liste entière : la tuile disparaît immédiatement, sans aller-retour
      // réseau supplémentaire ni recharger toute la page.
      queryClient.setQueryData<WishlistEntryResponse[]>(queryKeys.wishlist.all, (current) =>
        (current ?? []).filter((e) => e.id !== entry.id),
      )
    },
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
          removeMutation.mutate()
        }}
        disabled={removeMutation.isPending}
        aria-label={`Retirer ${entityQuery.data.title} de la wishlist`}
        title={removeMutation.isError ? 'Échec du retrait, réessaie' : 'Retirer de la wishlist'}
        className={`absolute top-1.5 right-1.5 flex h-6 w-6 items-center justify-center rounded-full text-textPrimary transition disabled:opacity-50 ${
          removeMutation.isError ? 'bg-danger/80' : 'bg-black/70 hover:bg-black/85'
        }`}
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
          <WishlistRow key={entry.id} entry={entry} entityTypesById={entityTypesById} />
        ))}
      </ul>
    </div>
  )
}
