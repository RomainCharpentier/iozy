import { useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { Gift } from 'lucide-react'
import { getSharedWishlist } from '../../api/wishlist'
import { queryKeys } from '../../lib/queryKeys'
import { ApiError } from '../../api/client'

/** Vue publique d'un lien de wishlist partagé - volontairement en dehors de
 * AppShell (pas de barre d'onglets "Ma collection/Rechercher/Mon profil/
 * Paramètres" : la personne qui ouvre ce lien n'a pas de compte et ne doit
 * rien pouvoir atteindre d'autre dans l'app, voir PublicWishlistController
 * côté backend). 404 (lien inconnu ou supprimé) affiche un message neutre,
 * jamais un détail qui laisserait deviner si le lien a existé un jour. */
export function SharedWishlistPage() {
  const { token } = useParams<{ token: string }>()

  const sharedQuery = useQuery({
    queryKey: queryKeys.wishlist.shared(token!),
    queryFn: () => getSharedWishlist(token!),
    retry: false,
  })

  const notFound = sharedQuery.isError && sharedQuery.error instanceof ApiError && sharedQuery.error.status === 404

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col gap-5 bg-background p-4">
      <div className="flex items-center gap-2 pt-4">
        <Gift size={22} className="text-accent" />
        <h1 className="font-display text-xl font-bold text-textPrimary">Liste d'envies</h1>
      </div>

      {sharedQuery.isLoading && <p className="text-textDim">Chargement...</p>}

      {notFound && (
        <p className="text-textDim">Ce lien n'existe pas ou n'est plus actif.</p>
      )}
      {sharedQuery.isError && !notFound && (
        <p className="text-textDim">Impossible de charger cette liste pour le moment.</p>
      )}

      {sharedQuery.isSuccess && sharedQuery.data.length === 0 && (
        <p className="text-textDim">Rien dans cette liste pour l'instant.</p>
      )}

      {sharedQuery.isSuccess && sharedQuery.data.length > 0 && (
        <ul className="grid grid-cols-3 gap-3">
          {sharedQuery.data.map((entry, index) => (
            <li key={index} className="flex flex-col gap-1.5">
              <div className="aspect-[2/3] w-full overflow-hidden rounded-lg bg-surface">
                {entry.coverImageUrl && (
                  <img src={entry.coverImageUrl} alt="" className="h-full w-full object-cover" />
                )}
              </div>
              <p className="text-xs text-textPrimary">{entry.title}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
