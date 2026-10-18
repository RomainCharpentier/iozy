import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { getSharedSpace } from '@/common/api/share'
import { queryKeys } from '@/common/lib/queryKeys'
import { ApiError } from '@/common/api/client'
import { TierBadge } from '@/common/components/TierBadge'
import { RANKS, type Rank } from '@/common/types/tierList'
import type { SharedCollectionItemDto, SharedTierBoardDto, SharedWishlistItemDto } from '@/common/types/share'
import { TexteCoupe } from '@/common/components/TexteCoupe'
import { Jaquette } from '@/common/components/Jaquette'
import { Squelette } from '@/common/components/Squelette'

/**
 * The shared space, seen by someone who has no account.
 *
 * A single page for both sections, where there used to be two - one per
 * link. The tabs only appear if both sections are really
 * shared: an inaccessible tab would already say something about the
 * owner.
 *
 * **Strictly read-only.** Deliberately outside the private AppShell: no
 * "Ma collection / Rechercher / Découvrir" tabs, no heart, no
 * avatar, no deep link to the application. The visitor must only be able to
 * reach this page. No card is clickable: there is no public
 * detail page, and sending an anonymous visitor to a private detail page
 * would expose them to the prices paid, notes and acquisition dates.
 *
 * What the page receives is already filtered by the server: a section that is not
 * shared is absent from the response, not hidden in the display.
 *
 * 404 (unknown or revoked link) shows a neutral message, never a detail
 * that would let one guess whether the link ever existed.
 */
export function SharedSpacePage() {
  const { token } = useParams<{ token: string }>()
  const [ongletDemande, setOngletDemande] = useState<'collection' | 'wishlist' | null>(null)

  const sharedQuery = useQuery({
    queryKey: queryKeys.sharedSpace(token!),
    queryFn: () => getSharedSpace(token!),
    retry: false,
  })

  const notFound = sharedQuery.isError && sharedQuery.error instanceof ApiError && sharedQuery.error.status === 404
  const data = sharedQuery.data

  const aCollection = !!data?.collection
  const aEnvies = !!data?.wishlist
  const lesDeux = aCollection && aEnvies
  // Without tabs (a single shared section), the active tab is simply
  // the one that exists - there is nothing to choose.
  const onglet = lesDeux ? (ongletDemande ?? 'collection') : aCollection ? 'collection' : 'wishlist'

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-5 bg-background p-4">
      {/* Minimal public shell: the name of the app, and nothing that looks like
          a private navigation. No identity is shown - the model has
          neither username nor avatar, and this page does not invent any. */}
      <header className="flex flex-col gap-1 pt-4">
        <span className="font-display text-sm font-semibold tracking-wide text-textDim uppercase">IozyCore</span>
        <h1 className="font-display text-2xl font-bold tracking-[-0.025em] text-textPrimary">
          {/* Without data (loading, dead link), a neutral title: announcing
              "Envies partagées" on a revoked link would suggest that it
              once led somewhere, which this page never says. */}
          {!data
            ? 'Espace partagé'
            : lesDeux
              ? 'Collection et envies partagées'
              : aCollection
                ? 'Collection partagée'
                : 'Envies partagées'}
        </h1>
      </header>

      {sharedQuery.isLoading && <Squelette lignes={3} />}
      {notFound && <p className="text-textDim">Ce lien n'existe pas ou n'est plus actif.</p>}
      {sharedQuery.isError && !notFound && (
        <p className="text-textDim">Impossible de charger cette page pour le moment.</p>
      )}

      {lesDeux && (
        <nav aria-label="Sections partagées" className="flex gap-2 border-b border-surface2">
          {(
            [
              ['collection', 'Collection', data!.collection!.reduce((n, u) => n + u.items.length, 0)],
              ['wishlist', 'Envies', data!.wishlist!.length],
            ] as const
          ).map(([cle, libelle, nombre]) => (
            <button
              key={cle}
              type="button"
              onClick={() => setOngletDemande(cle)}
              // aria-current rather than a simple style: the active tab must
              // be announced, not only colored.
              aria-current={onglet === cle ? 'page' : undefined}
              // Without this explicit name, the counter sticks to the label and a
              // screen reader announces "Collection 5" - a number without a unit,
              // stuck to a word, which means nothing to the ear.
              aria-label={`${libelle}, ${nombre} œuvre${nombre > 1 ? 's' : ''}`}
              className={`min-h-11 border-b-2 px-3 text-sm font-semibold transition-colors ${
                onglet === cle
                  ? 'border-accent text-textPrimary'
                  : 'border-transparent text-textDim hover:text-textPrimary'
              }`}
            >
              {libelle}
              <span className="ml-1.5 text-xs font-normal text-textDim">{nombre}</span>
            </button>
          ))}
        </nav>
      )}

      {data && onglet === 'collection' && aCollection && (
        <CollectionPartagee universes={data.collection!} tierLists={data.tierLists} />
      )}

      {data && onglet === 'wishlist' && aEnvies && <EnviesPartagees items={data.wishlist!} />}
    </div>
  )
}

function CollectionPartagee({
  universes,
  tierLists,
}: {
  universes: { label: string; items: SharedCollectionItemDto[] }[]
  tierLists: { general: SharedTierBoardDto[]; custom: SharedTierBoardDto[] } | null
}) {
  if (universes.length === 0) {
    return <p className="text-textDim">Cette collection est vide pour l'instant.</p>
  }
  return (
    <div className="flex flex-col gap-6">
      {universes.map((universe) => (
        <section key={universe.label} className="flex flex-col gap-3">
          <h2 className="font-display text-base font-semibold text-textPrimary">
            {universe.label} <span className="text-sm font-normal text-textDim">({universe.items.length})</span>
          </h2>
          <GrilleOeuvres>
            {universe.items.map((item) => (
              <CarteOeuvre
                key={`${universe.label}-${item.title}`}
                title={item.title}
                coverImageUrl={item.coverImageUrl}
                sousTitre={sousTitreCollection(item)}
              />
            ))}
          </GrilleOeuvres>
        </section>
      ))}

      {/* tierLists null = not shared: we then show STRICTLY nothing on
          this subject, not even a "classements non partagés" mention that
          would already reveal something. */}
      {tierLists && (tierLists.general.length > 0 || tierLists.custom.length > 0) && (
        <section className="flex flex-col gap-4 border-t border-line pt-5">
          <h2 className="font-display text-base font-semibold text-textPrimary">Classements</h2>
          {[...tierLists.general, ...tierLists.custom].map((board) => (
            <TableauClassement key={board.label} board={board} />
          ))}
        </section>
      )}
    </div>
  )
}

function EnviesPartagees({ items }: { items: SharedWishlistItemDto[] }) {
  if (items.length === 0) {
    return <p className="text-textDim">Rien dans cette liste pour l'instant.</p>
  }
  return (
    <GrilleOeuvres>
      {items.map((item) => (
        <CarteOeuvre key={item.title} title={item.title} coverImageUrl={item.coverImageUrl} sousTitre={null} />
      ))}
    </GrilleOeuvres>
  )
}

/** Progress displayed only if the total is really known - otherwise the
 * number of owned volumes alone, never an "X/?" nor a guessed total. */
function sousTitreCollection(item: SharedCollectionItemDto): string | null {
  const progression =
    item.totalVolumes !== null
      ? `${item.ownedVolumeCount}/${item.totalVolumes} tomes`
      : item.ownedVolumeCount > 0
        ? `${item.ownedVolumeCount} tome${item.ownedVolumeCount > 1 ? 's' : ''}`
        : null
  const texte = [item.editions.join(' · '), progression].filter(Boolean).join(' · ')
  return texte || null
}

/** Same grid for both sections: 2 columns from 375 px, then 3 and 4 -
 * a public collection must not become a microscopic grid on
 * mobile. */
function GrilleOeuvres({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{children}</div>
}

/**
 * The visual primitive common to both sections - a cover, a title, an
 * optional subtitle. Not clickable: no action, no link.
 * Maintaining two almost identical cards (one for the collection, one for
 * the wishes) would make their layout diverge at the first touch-up.
 */
function CarteOeuvre({
  title,
  coverImageUrl,
  sousTitre,
}: {
  title: string
  coverImageUrl: string | null
  sousTitre: string | null
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="aspect-[2/3] w-full overflow-hidden rounded-xl bg-surface2">
        <Jaquette
          src={coverImageUrl}
          loading="lazy"
          className="h-full w-full object-cover"
          repli={
            <span className="flex h-full w-full items-center justify-center px-2 text-center text-xs text-textDim">
              {title}
            </span>
          }
        />
      </div>
      <TexteCoupe as="p" texte={title} className="truncate text-sm font-semibold text-textPrimary" />
      {sousTitre && <p className="text-xs text-textDim">{sousTitre}</p>}
    </div>
  )
}

function TableauClassement({ board }: { board: SharedTierBoardDto }) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold text-textPrimary">{board.label}</h3>
      {/* S->F order imposed here: the backend returns the ranks really
          used, not necessarily in the order of the scale. */}
      {RANKS.filter((rank) => board.rows.some((row) => row.rank === rank)).map((rank) => {
        const row = board.rows.find((r) => r.rank === rank)!
        return (
          <div key={rank} className="flex items-stretch gap-3 rounded-2xl border border-surface2 bg-surface p-2.5">
            <div className="flex w-[52px] shrink-0 items-center justify-center">
              <TierBadge rank={rank as Rank} />
            </div>
            <div className="flex flex-1 flex-wrap items-center gap-2 py-1">
              {row.items.map((item) => (
                <span
                  key={item.title}
                  title={item.title}
                  className="aspect-[2/3] w-11 shrink-0 overflow-hidden rounded-lg"
                >
                  <Jaquette
                    src={item.coverImageUrl}
                    loading="lazy"
                    className="h-full w-full object-cover"
                    repli={
                      <span className="flex h-full w-full items-center justify-center bg-surface2 px-0.5 text-center text-[10px] text-textDim">
                        {item.title}
                      </span>
                    }
                  />
                </span>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
