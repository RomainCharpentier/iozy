import { useState, type ReactNode } from 'react'
import { TierBadge } from '@/common/components/TierBadge'
import { RANKS, type Rank } from '@/common/types/tierList'
import type {
  SharedCollectionItemDto,
  SharedPinnedWorkDto,
  SharedSpaceDto,
  SharedTierBoardDto,
  SharedWishlistItemDto,
} from '@/common/types/share'
import { TexteCoupe } from '@/common/components/TexteCoupe'
import { Jaquette } from '@/common/components/Jaquette'
import { formaterEuros } from '@/common/lib/formats'
import { detailValeur, libelleValidite, resumeEspace, titreEspace } from './libelles'

/**
 * The shared space as a visitor sees it (lot 217): the same component for the
 * public page and for the owner's preview on "Partager", so the preview never
 * lies about what is sent.
 *
 * <h2>Plein cadre</h2>
 * A big title, the pinned works ("Mes incontournables") first and big on a
 * glass panel, then the collection and the wishes on glass. The backdrop is
 * the first pinned work; the page that mounts this component declares it.
 *
 * <h2>Read-only</h2>
 * No card is clickable: there is no public detail page, and sending an
 * anonymous visitor to a private one would expose prices and notes. What
 * arrives is already filtered by the server: a section that is not shared is
 * null, not hidden here. The value only arrives when enough prices back it.
 */
export function EspacePartage({ data, enApercu = false }: { data: SharedSpaceDto; enApercu?: boolean }) {
  const [ongletDemande, setOngletDemande] = useState<'collection' | 'wishlist' | null>(null)
  const aCollection = !!data.collection
  const aEnvies = !!data.wishlist
  const lesDeux = aCollection && aEnvies
  const onglet = lesDeux ? (ongletDemande ?? 'collection') : aCollection ? 'collection' : 'wishlist'
  const Titre = enApercu ? 'h3' : 'h1'
  const SousTitre = enApercu ? 'h4' : 'h2'

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-3">
        <span className="iozy-teinte text-[13px] font-semibold tracking-[0.16em] text-accentText uppercase">
          {data.giftList ? 'Pour m’offrir quelque chose' : 'IozyCore · page publique'}
        </span>
        <Titre
          className={`font-display leading-[0.92] font-bold tracking-[-0.035em] text-textPrimary ${
            enApercu ? 'text-4xl' : 'text-[clamp(44px,9vw,84px)]'
          }`}
        >
          {titreEspace(data)}
        </Titre>
        <p className="text-base text-textDim">{resumeEspace(data)}</p>
        {data.giftList && data.expiresAt && <p className="text-sm text-textDim">{libelleValidite(data.expiresAt)}</p>}
        {data.value && (
          <p className="flex flex-col">
            <span className="font-display text-5xl leading-none font-bold tracking-[-0.04em] text-textPrimary">
              {formaterEuros(data.value.totalKnownValue)}
            </span>
            <span className="mt-1 text-sm text-textDim">Valeur estimée, {detailValeur(data.value)}</span>
          </p>
        )}
      </header>

      {data.pinned && data.pinned.length > 0 && (
        <Incontournables oeuvres={data.pinned} Titre={SousTitre} />
      )}

      {lesDeux && (
        <nav aria-label="Sections partagées" className="iozy-verre flex w-fit gap-1 rounded-full p-1">
          {(
            [
              ['collection', 'Collection', data.collection!.reduce((n, u) => n + u.items.length, 0)],
              ['wishlist', 'Envies', data.wishlist!.length],
            ] as const
          ).map(([cle, libelle, nombre]) => (
            <button
              key={cle}
              type="button"
              onClick={() => setOngletDemande(cle)}
              aria-current={onglet === cle ? 'page' : undefined}
              aria-label={`${libelle}, ${nombre} œuvre${nombre > 1 ? 's' : ''}`}
              className={`iozy-teinte min-h-11 rounded-full px-4 text-sm font-semibold transition-colors ${
                onglet === cle ? 'bg-vive text-encreVive' : 'text-textDim hover:text-textPrimary'
              }`}
            >
              {libelle}
              <span className="ml-1.5 text-xs font-normal opacity-80">{nombre}</span>
            </button>
          ))}
        </nav>
      )}

      {onglet === 'collection' && aCollection && (
        <CollectionPartagee universes={data.collection!} tierLists={data.tierLists} Titre={SousTitre} />
      )}
      {onglet === 'wishlist' && aEnvies && <EnviesPartagees items={data.wishlist!} />}
    </div>
  )
}

function Incontournables({
  oeuvres,
  Titre,
}: {
  oeuvres: SharedPinnedWorkDto[]
  Titre: 'h2' | 'h4'
}) {
  return (
    <section aria-label="Mes incontournables" className="iozy-verre iozy-verre--fort flex flex-col gap-3 rounded-3xl p-4 sm:p-5">
      <Titre className="text-[13px] font-semibold tracking-[0.12em] text-textDim uppercase">Mes incontournables</Titre>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {oeuvres.map((oeuvre) => (
          <li key={oeuvre.title} className="flex flex-col gap-1.5">
            <div className="aspect-[2/3] w-full overflow-hidden rounded-xl bg-surface2 shadow-lg">
              <Jaquette
                src={oeuvre.coverImageUrl}
                className="h-full w-full object-cover"
                repli={<Repli titre={oeuvre.title} />}
              />
            </div>
            <TexteCoupe as="p" texte={oeuvre.title} className="truncate text-sm font-semibold text-textPrimary" />
            {oeuvre.totalCount !== null && oeuvre.totalCount > 1 && (
              <p className="text-xs text-textDim">
                {oeuvre.ownedCount}/{oeuvre.totalCount}
              </p>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}

function CollectionPartagee({
  universes,
  tierLists,
  Titre,
}: {
  universes: { label: string; items: SharedCollectionItemDto[] }[]
  tierLists: { general: SharedTierBoardDto[]; custom: SharedTierBoardDto[] } | null
  Titre: 'h2' | 'h4'
}) {
  if (universes.length === 0) {
    return <p className="text-textDim">Cette collection est vide pour l'instant.</p>
  }
  return (
    <div className="flex flex-col gap-6">
      {universes.map((universe) => (
        <section key={universe.label} className="iozy-verre flex flex-col gap-3 rounded-3xl p-4">
          <Titre className="font-display text-lg font-semibold text-textPrimary">
            {universe.label} <span className="text-sm font-normal text-textDim">({universe.items.length})</span>
          </Titre>
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

      {/* tierLists null = not shared: STRICTLY nothing on this subject. */}
      {tierLists && (tierLists.general.length > 0 || tierLists.custom.length > 0) && (
        <section className="iozy-verre flex flex-col gap-4 rounded-3xl p-4">
          <Titre className="font-display text-lg font-semibold text-textPrimary">Classements</Titre>
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
    <section className="iozy-verre rounded-3xl p-4">
      <GrilleOeuvres>
        {items.map((item) => (
          <CarteOeuvre key={item.title} title={item.title} coverImageUrl={item.coverImageUrl} sousTitre={null} />
        ))}
      </GrilleOeuvres>
    </section>
  )
}

/** Progress only when the total is really known - never an "X/?" nor a guessed total. */
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

function GrilleOeuvres({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">{children}</div>
}

function Repli({ titre }: { titre: string }) {
  return (
    <span className="flex h-full w-full items-center justify-center px-2 text-center text-xs text-textDim">{titre}</span>
  )
}

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
        <Jaquette src={coverImageUrl} loading="lazy" className="h-full w-full object-cover" repli={<Repli titre={title} />} />
      </div>
      <TexteCoupe as="p" texte={title} className="truncate text-sm font-semibold text-textPrimary" />
      {sousTitre && <p className="text-xs text-textDim">{sousTitre}</p>}
    </div>
  )
}

function TableauClassement({ board }: { board: SharedTierBoardDto }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-semibold text-textPrimary">{board.label}</p>
      {RANKS.filter((rank) => board.rows.some((row) => row.rank === rank)).map((rank) => {
        const row = board.rows.find((r) => r.rank === rank)!
        return (
          <div key={rank} className="flex items-stretch gap-3 rounded-2xl border border-surface2 bg-verre p-2.5">
            <div className="flex w-[52px] shrink-0 items-center justify-center">
              <TierBadge rank={rank as Rank} />
            </div>
            <div className="flex flex-1 flex-wrap items-center gap-2 py-1">
              {row.items.map((item) => (
                <span key={item.title} title={item.title} className="aspect-[2/3] w-11 shrink-0 overflow-hidden rounded-lg">
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
