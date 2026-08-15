import { useQuery } from '@tanstack/react-query'
import { Check, Plus } from 'lucide-react'
import { findEdition, getCompleteness } from '../../api/purchaseAnalysis'
import { queryKeys } from '../../lib/queryKeys'
import { coverImageUrlFrom } from '../../lib/coverImage'
import { isSeriesOngoing } from '../../lib/seriesInfo'
import { ownedVolumeNumbers, type EditionGroup } from '../../lib/editionGroups'
import { VirtualVolumeCard } from './VirtualVolumeCard'
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
        // Catalogué mais manquant : vraie jaquette, atténuée modérément - reste
        // identifiable (voir "ne rends pas l'image tellement sombre qu'elle
        // devient illisible"), plus de grayscale (désature en plus de l'opacité,
        // rendait le tome encore moins reconnaissable qu'une simple atténuation).
        <img src={coverUrl} alt="" className={`absolute inset-0 h-full w-full object-cover ${owned ? '' : 'opacity-55'}`} />
      ) : (
        <span className="font-display text-base font-semibold text-textPrimary">{tile.volumeNumber}</span>
      )}
      {owned ? (
        <span className="absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-accentText">
          <Check size={11} strokeWidth={3} />
        </span>
      ) : (
        <span className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-0.5 bg-black/55 py-0.5 text-[10px] font-medium text-textPrimary">
          <Plus size={9} />
          {coverUrl && tile.volumeNumber}
        </span>
      )}
    </button>
  )
}

/**
 * "Mes tomes" + "À propos" - la grille elle-même, qui occupe le plus de
 * place, et les métadonnées secondaires en dessous (voir la maquette
 * validée : hors du bloc Identité, contrairement à la progression/édition -
 * voir EditionProgressSection, qui lit la même `activeGroup` juste à côté
 * dans le hero). Remplace l'ancien SeriesCompletenessSection (statistiques
 * texte) par une vue directement inspirée de Manga Collec : le possédé/
 * manquant se voit tome par tome, jamais caché dans un compteur ("5
 * manquants" ne dit pas LESQUELS).
 */
export function TomesGridSection({
  entityId,
  entityTitle,
  entityAttributes,
  variants,
  ownerships,
  activeGroup,
  onSelectMissingVolume,
  onSelectOwnedVariant,
}: {
  // Voir migration "Série -> Édition par ID" - préféré à entityTitle pour
  // toute relation persistante avec MangaEdition, immunisé contre un
  // renommage de la Série (entityTitle, lui, change après un renommage).
  entityId: string
  entityTitle: string
  // Uniquement pour "Statut" dans "À propos" (voir isSeriesOngoing) - le
  // reste de cette section lit déjà ses propres données (editionInfo/
  // completenessQuery), jamais besoin du sac d'attributs complet ailleurs ici.
  entityAttributes: Record<string, unknown>
  variants: VariantDto[]
  ownerships: OwnershipResponse[]
  // Décidée par le parent (EntityDetailPage), partagée avec
  // EditionProgressSection - les deux doivent réagir au même changement
  // d'édition sélectionnée, voir EntityDetailPage.activeGroup.
  activeGroup: EditionGroup
  onSelectMissingVolume: (volumeNumber: number, edition: string) => void
  onSelectOwnedVariant: (variantId: string) => void
}) {
  const owned = ownedVolumeNumbers(variants, ownerships, activeGroup.sourceEditions)

  // Mêmes clés de cache que EditionProgressSection (voir ce composant) -
  // React Query partage la requête entre les deux, jamais un double appel
  // réseau réel pour la même édition active.
  const completenessQuery = useQuery({
    queryKey: queryKeys.purchaseAnalysis.completeness(entityTitle, activeGroup.edition, owned),
    queryFn: () => getCompleteness(entityTitle, activeGroup.edition, owned, activeGroup.volumeNumbers, entityId),
    enabled: activeGroup.edition !== '',
  })
  const editionInfoQuery = useQuery({
    queryKey: queryKeys.purchaseAnalysis.edition(entityTitle, activeGroup.edition),
    queryFn: () => findEdition(entityTitle, activeGroup.edition, entityId),
    enabled: activeGroup.edition !== '',
    retry: false,
  })
  const editionInfo = editionInfoQuery.isSuccess ? editionInfoQuery.data : null

  const totalVolumes = completenessQuery.data?.totalVolumes ?? null
  const cataloguedMissing = completenessQuery.data?.cataloguedMissingVolumeNumbers ?? []
  const tiles = buildTiles(activeGroup, variants, owned, totalVolumes, cataloguedMissing)
  const ongoing = isSeriesOngoing(entityAttributes)
  // "À propos" : uniquement des données réellement connues (jamais de valeur
  // devinée/technique) - voir la maquette validée, qui liste explicitement
  // Éditeur/Statut/Tomes comme les seules infos utiles ici. Éditeur vient de
  // editionInfo (MangaEdition), jamais de entity.attributes.publisher : pour
  // un candidat Jikan, cet attribut est en réalité la revue de sérialisation
  // JAPONAISE, pas un éditeur français (voir pickCandidate côté QuickAddPage -
  // même bug déjà corrigé là, la même confusion serait réintroduite ici sinon).
  const aboutRows: Array<[string, string]> = []
  if (editionInfo?.publisher) aboutRows.push(['Éditeur', editionInfo.publisher])
  if (ongoing !== null) aboutRows.push(['Statut', ongoing ? 'En cours' : 'Terminée'])
  if (totalVolumes !== null) aboutRows.push(['Tomes', String(totalVolumes)])

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        {/* "Mes tomes" est la zone principale de la fiche (voir la maquette
            validée) - titre explicite, colonnes qui exploitent le container
            élargi (voir AppShell) sans revenir à l'ancien extrême illisible
            (10 colonnes fixes). */}
        <h2 className="font-display text-lg font-semibold text-textPrimary">Mes tomes</h2>
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-7 xl:grid-cols-8 2xl:grid-cols-9">
          {tiles.map((tile) =>
            tile.status === 'virtualMissing' ? (
              <VirtualVolumeCard
                key={tile.volumeNumber}
                volumeNumber={tile.volumeNumber}
                onClick={() => onSelectMissingVolume(tile.volumeNumber, activeGroup.edition)}
              />
            ) : (
              <TomeTileView
                key={tile.volumeNumber}
                tile={tile}
                onClick={() =>
                  tile.status === 'owned' && tile.variant
                    ? onSelectOwnedVariant(tile.variant.id)
                    : onSelectMissingVolume(tile.volumeNumber, activeGroup.edition)
                }
              />
            ),
          )}
        </div>
      </section>

      {/* "À propos" : bloc compact, secondaire par rapport aux tomes (voir la
          maquette validée) - chaque paire libellé/valeur est son propre bloc,
          disposées en grille auto-fit plutôt qu'un tableau à 2 colonnes fixe
          (jamais de longues lignes pleine largeur pour seulement 2-3 valeurs).
          Uniquement des données réellement connues - aucune ligne "Genre"/
          "Thèmes" ici : ni Jikan ni MyAnimeList ne sont exploités pour ces
          champs dans ce backend aujourd'hui, les afficher inventerait une
          donnée. Absente entièrement si rien n'est connu. */}
      {aboutRows.length > 0 && (
        <section className="flex flex-col gap-2 border-t border-surface pt-4">
          <h2 className="font-display text-lg font-semibold text-textPrimary">À propos</h2>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(160px,max-content))] gap-x-10 gap-y-3">
            {aboutRows.map(([label, value]) => (
              <dl key={label} className="flex flex-col gap-0.5 text-sm">
                <dt className="text-textDim">{label}</dt>
                <dd className="text-textPrimary">{value}</dd>
              </dl>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
