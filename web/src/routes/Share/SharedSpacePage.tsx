import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { getSharedSpace } from '../../api/share'
import { queryKeys } from '../../lib/queryKeys'
import { ApiError } from '../../api/client'
import { TierBadge } from '../TierLists/TierBadge'
import { RANKS, type Rank } from '../../types/tierList'
import type { SharedCollectionItemDto, SharedTierBoardDto, SharedWishlistItemDto } from '../../types/share'

/**
 * L'espace partagé, vu par quelqu'un qui n'a pas de compte.
 *
 * Une seule page pour les deux sections, là où il y en avait deux - une par
 * lien. Les onglets n'apparaissent que si les deux sections sont réellement
 * partagées : un onglet inaccessible dirait déjà quelque chose du
 * propriétaire.
 *
 * **Strictement en lecture.** Volontairement hors de l'AppShell privé : pas
 * d'onglets « Ma collection / Rechercher / Découvrir », pas de cœur, pas
 * d'avatar, aucun lien profond vers l'application. Le visiteur ne doit pouvoir
 * atteindre que cette page. Aucune carte n'est cliquable : il n'existe pas de
 * fiche publique, et envoyer un visiteur anonyme vers une fiche privée
 * l'exposerait aux prix payés, notes et dates d'acquisition.
 *
 * Ce que la page reçoit est déjà filtré par le serveur : une section non
 * partagée est absente de la réponse, pas masquée à l'affichage.
 *
 * 404 (lien inconnu ou révoqué) affiche un message neutre, jamais un détail
 * qui laisserait deviner si le lien a existé un jour.
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
  // Sans onglets (une seule section partagée), l'onglet actif est simplement
  // celle qui existe - il n'y a rien à choisir.
  const onglet = lesDeux ? (ongletDemande ?? 'collection') : aCollection ? 'collection' : 'wishlist'

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-5 bg-background p-4">
      {/* Coquille publique minimale : le nom de l'app, et rien qui ressemble à
          une navigation privée. Aucune identité n'est affichée - le modèle n'a
          ni pseudo ni avatar, et cette page n'en invente pas. */}
      <header className="flex flex-col gap-1 pt-4">
        <span className="font-display text-sm font-semibold tracking-wide text-textDim uppercase">IozyCore</span>
        <h1 className="font-display text-2xl font-bold text-textPrimary">
          {/* Sans données (chargement, lien mort), un titre neutre : annoncer
              « Envies partagées » sur un lien révoqué laisserait croire qu'il
              a un jour mené quelque part, ce que cette page ne dit jamais. */}
          {!data
            ? 'Espace partagé'
            : lesDeux
              ? 'Collection et envies partagées'
              : aCollection
                ? 'Collection partagée'
                : 'Envies partagées'}
        </h1>
      </header>

      {sharedQuery.isLoading && <p className="text-textDim">Chargement...</p>}
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
              // aria-current plutôt qu'un simple style : l'onglet actif doit
              // être annoncé, pas seulement coloré.
              aria-current={onglet === cle ? 'page' : undefined}
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

      {/* tierLists null = non partagées : on n'affiche alors STRICTEMENT rien à
          ce sujet, pas même une mention « classements non partagés » qui
          révélerait déjà quelque chose. */}
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

/** Progression affichée seulement si le total est réellement connu - sinon le
 * nombre de tomes possédés seul, jamais un « X/? » ni un total deviné. */
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

/** Même grille pour les deux sections : 2 colonnes dès 375 px, puis 3 et 4 -
 * une collection publique ne doit pas devenir une grille microscopique sur
 * mobile. */
function GrilleOeuvres({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{children}</div>
}

/**
 * La primitive visuelle commune aux deux sections - une jaquette, un titre, un
 * sous-titre facultatif. Non cliquable : aucune action, aucun lien.
 * Maintenir deux cartes presque identiques (une pour la collection, une pour
 * les envies) ferait diverger leur mise en page à la première retouche.
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
        {coverImageUrl ? (
          <img src={coverImageUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <span className="flex h-full w-full items-center justify-center px-2 text-center text-xs text-textDim">
            {title}
          </span>
        )}
      </div>
      <p className="truncate text-sm font-semibold text-textPrimary" title={title}>
        {title}
      </p>
      {sousTitre && <p className="text-xs text-textDim">{sousTitre}</p>}
    </div>
  )
}

function TableauClassement({ board }: { board: SharedTierBoardDto }) {
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
                <span
                  key={item.title}
                  title={item.title}
                  className="aspect-[2/3] w-11 shrink-0 overflow-hidden rounded-lg"
                >
                  {item.coverImageUrl ? (
                    <img src={item.coverImageUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
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
