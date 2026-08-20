import { useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { Library } from 'lucide-react'
import { getSharedCollection } from '../../api/collectionShare'
import { queryKeys } from '../../lib/queryKeys'
import { ApiError } from '../../api/client'
import { TierBadge } from '../TierLists/TierBadge'
import { RANKS, type Rank } from '../../types/tierList'
import type { SharedCollectionItemDto, SharedTierBoardDto } from '../../types/collectionShare'

/** Vue publique d'une collection partagée - volontairement en dehors de
 * AppShell (comme SharedWishlistPage) : la personne qui ouvre ce lien n'a pas
 * de compte et ne doit rien pouvoir atteindre d'autre dans l'app, voir
 * PublicCollectionController. 404 (lien inconnu ou révoqué) affiche un
 * message neutre, jamais un détail qui laisserait deviner si le lien a
 * existé un jour. */
export function SharedCollectionPage() {
  const { token } = useParams<{ token: string }>()

  const sharedQuery = useQuery({
    queryKey: queryKeys.sharedCollection(token!),
    queryFn: () => getSharedCollection(token!),
    retry: false,
  })

  const notFound = sharedQuery.isError && sharedQuery.error instanceof ApiError && sharedQuery.error.status === 404
  const data = sharedQuery.data

  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 bg-background p-4">
      <div className="flex items-center gap-2 pt-4">
        <Library size={22} className="text-accentText" />
        <h1 className="font-display text-xl font-bold text-textPrimary">Collection partagée</h1>
      </div>

      {sharedQuery.isLoading && <p className="text-textDim">Chargement...</p>}
      {notFound && <p className="text-textDim">Ce lien n'existe pas ou n'est plus actif.</p>}
      {sharedQuery.isError && !notFound && (
        <p className="text-textDim">Impossible de charger cette collection pour le moment.</p>
      )}

      {data && data.universes.length === 0 && <p className="text-textDim">Cette collection est vide pour l'instant.</p>}

      {data?.universes.map((universe) => (
        <section key={universe.label} className="flex flex-col gap-3">
          <h2 className="font-display text-base font-semibold text-textPrimary">
            {universe.label} <span className="text-sm font-normal text-textDim">({universe.items.length})</span>
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {universe.items.map((item) => (
              <SharedItemCard key={`${universe.label}-${item.title}`} item={item} />
            ))}
          </div>
        </section>
      ))}

      {/* tierLists null = non partagées : on n'affiche alors STRICTEMENT rien
          à ce sujet, pas même une mention "classements non partagés" qui
          révélerait déjà quelque chose du propriétaire. */}
      {data?.tierLists && (data.tierLists.general.length > 0 || data.tierLists.custom.length > 0) && (
        <section className="flex flex-col gap-4 border-t border-line pt-5">
          <h2 className="font-display text-base font-semibold text-textPrimary">Classements</h2>
          {[...data.tierLists.general, ...data.tierLists.custom].map((board) => (
            <SharedBoard key={board.label} board={board} />
          ))}
        </section>
      )}
    </div>
  )
}

function SharedItemCard({ item }: { item: SharedCollectionItemDto }) {
  // Progression affichée seulement si le total est réellement connu - sinon
  // le nombre de tomes possédés seul, jamais un "X/?" ni un total deviné.
  const progression =
    item.totalVolumes !== null
      ? `${item.ownedVolumeCount}/${item.totalVolumes} tomes`
      : item.ownedVolumeCount > 0
        ? `${item.ownedVolumeCount} tome${item.ownedVolumeCount > 1 ? 's' : ''}`
        : null

  return (
    <div className="flex flex-col gap-1.5">
      <div className="aspect-[2/3] w-full overflow-hidden rounded-xl bg-surface2">
        {item.coverImageUrl ? (
          <img src={item.coverImageUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="flex h-full w-full items-center justify-center px-2 text-center text-xs text-textDim">
            {item.title}
          </span>
        )}
      </div>
      <p className="truncate text-sm font-semibold text-textPrimary" title={item.title}>
        {item.title}
      </p>
      <p className="text-xs text-textDim">
        {[item.editions.join(' · '), progression].filter(Boolean).join(' · ')}
      </p>
    </div>
  )
}

function SharedBoard({ board }: { board: SharedTierBoardDto }) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold text-textPrimary">{board.label}</h3>
      {/* Ordre S->F imposé ici : le backend renvoie les rangs réellement
          utilisés, pas forcément dans l'ordre de l'échelle. */}
      {RANKS.filter((rank) => board.rows.some((row) => row.rank === rank)).map((rank) => {
        const row = board.rows.find((r) => r.rank === rank)!
        return (
          <div key={rank} className="flex items-stretch gap-3 rounded-2xl border border-surface2 bg-surface p-2.5">
            <div className="flex w-[52px] shrink-0 items-center justify-center">
              <TierBadge rank={rank as Rank} />
            </div>
            <div className="flex flex-1 flex-wrap items-center gap-2 py-1">
              {row.items.map((item) => (
                <span key={item.title} title={item.title} className="aspect-[2/3] w-11 shrink-0 overflow-hidden rounded-lg">
                  {item.coverImageUrl ? (
                    <img src={item.coverImageUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center bg-surface2 px-0.5 text-center text-[10px] text-textDim">
                      {item.title}
                    </span>
                  )}
                </span>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
