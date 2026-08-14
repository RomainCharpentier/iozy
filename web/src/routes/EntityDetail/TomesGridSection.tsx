import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Check, Plus } from 'lucide-react'
import { getCompleteness } from '../../api/purchaseAnalysis'
import { queryKeys } from '../../lib/queryKeys'
import { coverImageUrlFrom } from '../../lib/coverImage'
import { groupVariantsByEdition, ownedVolumeNumbers, resolveEditionView, type EditionGroup } from '../../lib/editionGroups'
import { Chip } from '../../components/Chip'
import type { OwnershipResponse, VariantDto } from '../../types/api'

interface TomeTile {
  volumeNumber: number
  status: 'owned' | 'cataloguedMissing' | 'virtualMissing'
  variant?: VariantDto
}

/** Construit la grille visuelle d'une édition : un possédé (Ownership active)
 * n'est jamais confondu avec un simplement catalogué (modèle Tome !=
 * Ownership) ni avec un purement virtuel (numéro déduit de totalVolumes,
 * jamais catalogué). Sans totalVolumes connu, on ne montre que ce qu'on
 * connaît réellement (possédé ou catalogué) - jamais de tuile virtuelle
 * devinée sans un total sur lequel s'appuyer. */
function buildTiles(group: EditionGroup, variants: VariantDto[], owned: number[], totalVolumes: number | null, cataloguedMissing: number[]): TomeTile[] {
  const variantsByNumber = new Map<number, VariantDto>()
  // group.sourceEditions plutôt que group.edition seul : un groupe fusionné
  // (voir resolveEditionView) doit retrouver le Variant d'un tome sans
  // édition précisée aussi bien que celui de l'édition nommée.
  const sourceSet = new Set(group.sourceEditions)
  for (const variant of variants) {
    const num = variant.attributes.volumeNumber
    const edition = typeof variant.attributes.edition === 'string' ? variant.attributes.edition.trim() : ''
    if (typeof num === 'number' && sourceSet.has(edition)) variantsByNumber.set(num, variant)
  }
  const ownedSet = new Set(owned)

  if (totalVolumes === null) {
    return group.volumeNumbers.map((n) => ({
      volumeNumber: n,
      status: ownedSet.has(n) ? ('owned' as const) : ('cataloguedMissing' as const),
      variant: variantsByNumber.get(n),
    }))
  }

  const cataloguedMissingSet = new Set(cataloguedMissing)
  const tiles: TomeTile[] = []
  for (let n = 1; n <= totalVolumes; n++) {
    if (ownedSet.has(n)) {
      tiles.push({ volumeNumber: n, status: 'owned', variant: variantsByNumber.get(n) })
    } else if (cataloguedMissingSet.has(n)) {
      tiles.push({ volumeNumber: n, status: 'cataloguedMissing', variant: variantsByNumber.get(n) })
    } else {
      tiles.push({ volumeNumber: n, status: 'virtualMissing' })
    }
  }
  return tiles
}

function TomeTileView({ tile, onClick }: { tile: TomeTile; onClick: () => void }) {
  const coverUrl = tile.variant ? coverImageUrlFrom(tile.variant.attributes) : null
  const owned = tile.status === 'owned'
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={owned ? `Tome ${tile.volumeNumber}, possédé` : `Tome ${tile.volumeNumber}, manquant - ajouter à ma collection`}
      className={`relative flex aspect-[2/3] flex-col items-center justify-center overflow-hidden rounded-lg text-left ${owned ? 'bg-surface2' : 'bg-surface2/50'}`}
    >
      {coverUrl ? (
        <img
          src={coverUrl}
          alt=""
          className={`absolute inset-0 h-full w-full object-cover ${owned ? '' : 'opacity-40 grayscale'}`}
        />
      ) : (
        <span className={`font-display text-base font-semibold ${owned ? 'text-textPrimary' : 'text-textDim'}`}>
          {tile.volumeNumber}
        </span>
      )}
      {owned ? (
        <span className="absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-accentText">
          <Check size={11} strokeWidth={3} />
        </span>
      ) : (
        <span className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-0.5 bg-black/55 py-0.5 text-[10px] font-medium text-textPrimary">
          <Plus size={9} />
          {/* Le numéro n'apparaît qu'une fois : dans le badge quand une jaquette
              occupe le centre de la tuile, sinon il est déjà le contenu central. */}
          {coverUrl && tile.volumeNumber}
        </span>
      )}
    </button>
  )
}

/**
 * Cœur de la fiche série manga (voir audit UX "fiche série trop technique") :
 * une seule ligne de progression ("X / Y tomes possédés", remplace le trio
 * redondant pastille Possédé / titre "Tomes" / compteur séparé), l'édition
 * concernée juste en dessous - discrète s'il n'y en a qu'une pertinente (voir
 * resolveEditionView), un vrai sélecteur seulement s'il faut vraiment choisir
 * entre plusieurs (voir hasMixedEditions côté editionGroups.ts) - puis la
 * grille de tomes elle-même, qui occupe le plus de place. Remplace l'ancien
 * SeriesCompletenessSection (statistiques texte) par une vue directement
 * inspirée de Manga Collec : le possédé/manquant se voit tome par tome,
 * jamais caché dans un compteur ("5 manquants" ne dit pas LESQUELS).
 */
export function TomesGridSection({
  entityTitle,
  variants,
  ownerships,
  onSelectMissingVolume,
  onSelectOwnedVariant,
}: {
  entityTitle: string
  variants: VariantDto[]
  ownerships: OwnershipResponse[]
  onSelectMissingVolume: (volumeNumber: number, edition: string) => void
  onSelectOwnedVariant: (variantId: string) => void
}) {
  const groups = groupVariantsByEdition(variants)
  const displayGroups = resolveEditionView(groups)
  const [activeEdition, setActiveEdition] = useState<string | null>(null)

  if (displayGroups.length === 0) return null

  const activeGroup = displayGroups.find((g) => g.edition === activeEdition) ?? displayGroups[0]
  const owned = ownedVolumeNumbers(variants, ownerships, activeGroup.sourceEditions)

  const completenessQuery = useQuery({
    queryKey: queryKeys.purchaseAnalysis.completeness(entityTitle, activeGroup.edition, owned),
    queryFn: () => getCompleteness(entityTitle, activeGroup.edition, owned, activeGroup.volumeNumbers),
    enabled: activeGroup.edition !== '',
  })

  const totalVolumes = completenessQuery.data?.totalVolumes ?? null
  const cataloguedMissing = completenessQuery.data?.cataloguedMissingVolumeNumbers ?? []
  const tiles = buildTiles(activeGroup, variants, owned, totalVolumes, cataloguedMissing)

  return (
    <section className="flex flex-col gap-3">
      {/* Une seule ligne répond à "combien j'en ai sur combien" - avant,
          cette même information était éclatée entre une pastille "Possédé"
          globale, un titre de section "Tomes" et un compteur "0 possédé"
          séparé (voir audit "informations redondantes"). */}
      <p className="font-display text-2xl font-bold text-textPrimary">
        {totalVolumes !== null
          ? `${owned.length} / ${totalVolumes} tomes possédés`
          : `${owned.length} tome${owned.length > 1 ? 's' : ''} possédé${owned.length > 1 ? 's' : ''}`}
      </p>

      {/* Édition : une ligne discrète pour le cas courant - une seule édition
          pertinente, déjà fusionnée avec les tomes sans édition précisée
          (voir resolveEditionView) plutôt que de les afficher comme un champ
          technique séparé. Un vrai sélecteur seulement s'il existe un choix
          réel entre plusieurs éditions nommées. Aucune ligne du tout si
          aucune édition n'est connue - pas la peine de l'écrire en creux. */}
      {displayGroups.length > 1 ? (
        <div className="flex flex-wrap gap-2">
          {displayGroups.map((g) => (
            <Chip
              key={g.edition || '(non précisée)'}
              label={g.edition || 'Non précisée'}
              isActive={g.edition === activeGroup.edition}
              onClick={() => setActiveEdition(g.edition)}
            />
          ))}
        </div>
      ) : (
        activeGroup.edition !== '' && <p className="text-sm text-textDim">{activeGroup.edition}</p>
      )}

      {/* Le nombre de colonnes s'adapte à la largeur disponible plutôt qu'un
          nombre fixe - sur desktop, 5 colonnes fixes auraient étiré chaque
          jaquette à une taille disproportionnée. */}
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10">
        {tiles.map((tile) => (
          <TomeTileView
            key={tile.volumeNumber}
            tile={tile}
            onClick={() =>
              tile.status === 'owned' && tile.variant
                ? onSelectOwnedVariant(tile.variant.id)
                : onSelectMissingVolume(tile.volumeNumber, activeGroup.edition)
            }
          />
        ))}
      </div>
    </section>
  )
}
