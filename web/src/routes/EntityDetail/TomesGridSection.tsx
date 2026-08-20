import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Check, Plus, Sparkles } from 'lucide-react'
import { getCompleteness } from '../../api/purchaseAnalysis'
import { getEntityTierSummary, setGeneralRank } from '../../api/tierLists'
import { queryKeys } from '../../lib/queryKeys'
import { coverImageUrlFrom } from '../../lib/coverImage'
import { ownedVolumeNumbers, type EditionGroup } from '../../lib/editionGroups'
import { AssistantSection } from './AssistantSection'
import { VirtualVolumeCard } from './VirtualVolumeCard'
import { VolumeInteractionPanel } from './VolumeInteractionPanel'
import { AddVolumeSection } from './AddVolumeSection'
import { TierBadge } from '../TierLists/TierBadge'
import { TierPicker } from '../TierLists/TierPicker'
import { RANKS, type Rank } from '../../types/tierList'
import type { ExperienceResponse, OwnershipResponse, VariantDto } from '../../types/api'

/**
 * "Mes classements" (voir DS v1.1 §52) : rang général visuellement dominant
 * (voir TierListService.customRanksFor côté backend, même commentaire) + les
 * Tier Lists personnalisées où cette œuvre est RÉELLEMENT classée. Rang
 * général géré ICI (au niveau Entity, pas Variant/tome - un classement porte
 * sur la série/l'œuvre entière, jamais un tome individuel), via le même
 * TierPicker que les boards (voir CustomTierBoardPage/GeneralTierBoardPage).
 */
function TierSummarySection({
  entityId,
  entityTitle,
  entityTypeLabel,
  coverImageUrl,
}: {
  entityId: string
  entityTitle: string
  entityTypeLabel: string | null
  coverImageUrl: string | null
}) {
  const queryClient = useQueryClient()
  const [picking, setPicking] = useState(false)
  const summaryQuery = useQuery({
    queryKey: queryKeys.tierLists.entitySummary(entityId),
    queryFn: () => getEntityTierSummary(entityId),
  })

  const rankMutation = useMutation({
    mutationFn: (rank: Rank | null) => setGeneralRank(entityId, rank),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tierLists.entitySummary(entityId) })
      setPicking(false)
    },
  })

  const generalRank = summaryQuery.data?.generalRank ?? null
  const customRanks = summaryQuery.data?.customRanks ?? []

  return (
    <section className="flex flex-col gap-3 border-t border-surface pt-4">
      <h2 className="font-display text-lg font-semibold text-textPrimary">Mes classements</h2>

      <div className="rounded-2xl border border-surface2 bg-surface p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <span className="text-[11px] font-semibold tracking-wide text-textDim uppercase">Mon classement</span>
          <Link to="/tier-lists" className="min-h-9 text-xs font-semibold text-accentText">
            Toutes mes Tier Lists
          </Link>
        </div>

        {summaryQuery.isLoading ? (
          <p className="mt-3 text-sm text-textDim">Chargement...</p>
        ) : generalRank ? (
          <div className="mt-3 flex items-center gap-3">
            <TierBadge rank={generalRank} />
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-sm font-semibold text-textPrimary">
                {entityTypeLabel ? `${entityTypeLabel} — général` : 'Classement général'}
              </span>
              <span className="text-xs text-textDim">Ton jugement, pas une note publique.</span>
            </span>
            <button
              type="button"
              onClick={() => setPicking(true)}
              className="shrink-0 rounded-xl border border-fieldBorder bg-surface2 px-3.5 py-2.5 text-xs font-semibold text-textPrimary transition-colors hover:bg-rowHover"
            >
              Modifier
            </button>
          </div>
        ) : (
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <span className="flex min-h-11 items-center rounded-xl border border-dashed border-fieldBorder bg-surface2 px-3.5 text-sm font-semibold text-textDim">
              Non classée
            </span>
            <button
              type="button"
              onClick={() => setPicking(true)}
              className="flex min-h-11 items-center gap-2 rounded-xl bg-accent px-4 text-sm font-semibold text-accentInk transition-transform hover:-translate-y-0.5"
            >
              <Sparkles size={15} />
              Classer cette œuvre
            </button>
          </div>
        )}

        {customRanks.length > 0 && (
          <div className="mt-3.5 flex flex-col gap-1 border-t border-surface pt-3">
            {customRanks.map((entry) => (
              <Link
                key={entry.tierListId}
                to={`/tier-lists/${entry.tierListId}`}
                className="flex items-center gap-2.5 rounded-lg py-1 text-sm text-textPrimary transition-colors hover:text-accentText"
              >
                <TierBadge rank={entry.rank} size="compact" />
                {entry.tierListName}
              </Link>
            ))}
          </div>
        )}
      </div>

      {picking && (
        <TierPicker
          open
          onClose={() => setPicking(false)}
          title={entityTitle}
          coverImageUrl={coverImageUrl}
          activeRanks={RANKS}
          currentRank={generalRank}
          onSelect={(rank) => rankMutation.mutate(rank)}
        />
      )}
    </section>
  )
}

export interface TomeTile {
  volumeNumber: number
  status: 'owned' | 'cataloguedMissing' | 'virtualMissing'
  variant?: VariantDto
}

// Aperçu pour les séries longues (voir Naruto, 72 tomes) : au lieu de
// rendre les N tuiles d'un coup, n'en montre qu'un aperçu compact par
// défaut (environ 1 ligne desktop large / 1-2 lignes mobile - 8 tuiles
// tombe pile sur 1 ligne à xl:grid-cols-8 tout en restant 2 lignes à
// grid-cols-4 mobile). Pas de seuil pile sur PREVIEW_TILE_COUNT : en
// dessous de LONG_SERIES_THRESHOLD, "Voir tout (N)" ne masquerait qu'une
// poignée de tuiles - pas utile pour l'utilisateur, voir "no backend
// pagination" (pur découpage de la liste déjà en mémoire, rien de plus).
const PREVIEW_TILE_COUNT = 8
const LONG_SERIES_THRESHOLD = 12

/** Aperçu = les PREVIEW_TILE_COUNT premiers tomes + tout tome possédé situé
 * plus loin, dédupliqué (voir "le possédé ne doit jamais disparaître dans
 * un aperçu" - un tome possédé au-delà de l'aperçu par défaut, ex. le tome
 * 45 sur 72, doit rester visible sans avoir à cliquer "Voir tout"). */
function buildPreviewTiles(tiles: TomeTile[]): TomeTile[] {
  if (tiles.length <= LONG_SERIES_THRESHOLD) return tiles
  const firstTiles = tiles.slice(0, PREVIEW_TILE_COUNT)
  const seen = new Set(firstTiles.map((t) => t.volumeNumber))
  const extraOwned = tiles.filter((t) => t.status === 'owned' && !seen.has(t.volumeNumber))
  return [...firstTiles, ...extraOwned].sort((a, b) => a.volumeNumber - b.volumeNumber)
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

  // Tomes réellement catalogués/possédés AU-DELÀ du total connu de l'édition :
  // affichés à la suite plutôt qu'escamotés. Le cas existe dès qu'un tome est
  // ajouté à la main avec un numéro trop grand, ou renuméroté ainsi (voir
  // VariantNumberEditor) - les masquer rendait la donnée invisible ET
  // irrécupérable depuis l'écran. Un total d'édition peut aussi être faux :
  // mieux vaut montrer la contradiction que de la cacher.
  const beyondTotal = [...new Set([...owned, ...group.volumeNumbers])]
    .filter((n) => n > totalVolumes)
    .sort((a, b) => a - b)
  for (const n of beyondTotal) {
    tiles.push({
      volumeNumber: n,
      status: ownedSet.has(n) ? 'owned' : 'cataloguedMissing',
      variant: variantsByNumber.get(n),
    })
  }
  return tiles
}

function TomeTileView({ tile, isActive, onClick }: { tile: TomeTile; isActive: boolean; onClick: () => void }) {
  const coverUrl = tile.variant ? coverImageUrlFrom(tile.variant.attributes) : null
  const owned = tile.status === 'owned'
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={owned ? `Voir le tome ${tile.volumeNumber}` : `Ajouter le tome ${tile.volumeNumber}`}
      // Sélection = tuile ↔ panneau ouvert (voir VolumeInteractionPanel) :
      // anneau accent discret, jamais un gros effet - juste de quoi
      // reconnaître quelle carte a ouvert le panneau actuellement affiché.
      className={`relative flex aspect-[2/3] flex-col items-center justify-center overflow-hidden rounded-lg text-left transition ${
        owned ? 'bg-surface2' : 'bg-surface2/50'
      } ${isActive ? 'ring-2 ring-accent' : ''}`}
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
        <span className="absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-accentInk">
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
 * <p>
 * Interaction Tome : UNE seule source de vérité (`activeVolumeNumber`),
 * jamais plusieurs états indépendants (voir l'ancien showAddVolume/
 * selectedVolumeForAdd/highlightedVariantId - remplacés). Le tome
 * sélectionné est recalculé (`activeTile`) à CHAQUE rendu à partir des
 * tuiles fraîchement construites, jamais stocké séparément : après un ajout
 * réussi, la tuile passe seule de "manquant" à "possédé" sans code de
 * transition dédié, voir VolumeInteractionPanel.
 */
export function TomesGridSection({
  entityId,
  entityTypeId,
  entityTypeLabel,
  entityTitle,
  entityAttributes,
  variants,
  ownerships,
  experiences,
  activeGroup,
}: {
  // Voir migration "Série -> Édition par ID" - préféré à entityTitle pour
  // toute relation persistante avec MangaEdition, immunisé contre un
  // renommage de la Série (entityTitle, lui, change après un renommage).
  entityId: string
  // Pour AddOwnershipForm/VariantCoverEditor (voir VolumeInteractionPanel) -
  // quickAdd/searchVolumes en ont besoin comme partout ailleurs dans l'app.
  entityTypeId: string
  // Uniquement pour la ligne "{type} — général" de Mes classements (voir
  // TierSummarySection) - null tant que EntityDetailPage n'a pas fini de
  // résoudre les types (jamais bloquant, juste un intitulé générique en repli).
  entityTypeLabel: string | null
  entityTitle: string
  // Uniquement pour "Statut" dans "À propos" (voir isSeriesOngoing) - le
  // reste de cette section lit déjà ses propres données (editionInfo/
  // completenessQuery), jamais besoin du sac d'attributs complet ailleurs ici.
  entityAttributes: Record<string, unknown>
  variants: VariantDto[]
  ownerships: OwnershipResponse[]
  // Uniquement pour l'Assistant ("Où en suis-je dans mes lectures ?", voir
  // AssistantSection) - déjà chargées par EntityDetailPage pour la section
  // Expériences, jamais une requête de plus.
  experiences: ExperienceResponse[]
  // Décidée par le parent (EntityDetailPage), partagée avec
  // EditionProgressSection - les deux doivent réagir au même changement
  // d'édition sélectionnée, voir EntityDetailPage.activeGroup.
  activeGroup: EditionGroup
}) {
  const [activeVolumeNumber, setActiveVolumeNumber] = useState<number | null>(null)
  const [showAllTomes, setShowAllTomes] = useState(false)

  // Édition changée pendant qu'un panneau est ouvert : ferme plutôt que de
  // risquer un tome sélectionné qui n'appartient plus à l'édition affichée
  // (voir "préférence simplicité : edition change -> close panel"). Entity
  // changée (navigation vers une autre fiche sans démonter ce composant,
  // React Router peut réutiliser l'instance) : même chose, défensif.
  // L'aperçu se réduit aussi : rester "ouvert" sur l'édition précédente
  // n'aurait pas de sens une fois les tomes affichés différents.
  useEffect(() => {
    setActiveVolumeNumber(null)
    setShowAllTomes(false)
  }, [activeGroup.edition, entityId])

  const owned = ownedVolumeNumbers(variants, ownerships, activeGroup.sourceEditions)

  // Mêmes clés de cache que EditionProgressSection (voir ce composant) -
  // React Query partage la requête entre les deux, jamais un double appel
  // réseau réel pour la même édition active.
  const completenessQuery = useQuery({
    queryKey: queryKeys.purchaseAnalysis.completeness(entityTitle, activeGroup.edition, owned),
    queryFn: () => getCompleteness(entityTitle, activeGroup.edition, owned, activeGroup.volumeNumbers, entityId),
    enabled: activeGroup.edition !== '',
  })
  const totalVolumes = completenessQuery.data?.totalVolumes ?? null
  const cataloguedMissing = completenessQuery.data?.cataloguedMissingVolumeNumbers ?? []
  const tiles = buildTiles(activeGroup, variants, owned, totalVolumes, cataloguedMissing)
  const activeTile = tiles.find((t) => t.volumeNumber === activeVolumeNumber) ?? null
  const isLongSeries = tiles.length > LONG_SERIES_THRESHOLD
  const visibleTiles = showAllTomes ? tiles : buildPreviewTiles(tiles)

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        {/* "Mes tomes" est la zone principale de la fiche (voir la maquette
            validée) - titre explicite, colonnes qui exploitent le container
            élargi (voir AppShell) sans revenir à l'ancien extrême illisible
            (10 colonnes fixes). */}
        <h2 className="font-display text-lg font-semibold text-textPrimary">Mes tomes</h2>
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-7 xl:grid-cols-8 2xl:grid-cols-9">
          {visibleTiles.map((tile) =>
            tile.status === 'virtualMissing' ? (
              <VirtualVolumeCard
                key={tile.volumeNumber}
                volumeNumber={tile.volumeNumber}
                isActive={tile.volumeNumber === activeVolumeNumber}
                onClick={() => setActiveVolumeNumber(tile.volumeNumber)}
              />
            ) : (
              <TomeTileView
                key={tile.volumeNumber}
                tile={tile}
                isActive={tile.volumeNumber === activeVolumeNumber}
                onClick={() => setActiveVolumeNumber(tile.volumeNumber)}
              />
            ),
          )}
        </div>
        {/* Aperçu pour série longue (voir buildPreviewTiles) - jamais de
            pagination backend, juste le même tableau `tiles` déjà en
            mémoire, tronqué ou non. */}
        {isLongSeries && (
          <button
            type="button"
            onClick={() => setShowAllTomes((v) => !v)}
            className="w-fit text-sm text-accentText underline"
          >
            {showAllTomes ? 'Réduire' : `Voir tout (${tiles.length})`}
          </button>
        )}
        {/* Parcours manuel (voir AddVolumeSection) - reste sous Mes tomes,
            styling secondaire : ne devrait plus être nécessaire pour un tome
            déjà visible dans la grille ci-dessus (voir le parcours
            contextuel, VolumeInteractionPanel), seulement pour un numéro/une
            édition hors de ce qui est déjà catalogué. */}
        <AddVolumeSection entityId={entityId} entityTypeId={entityTypeId} title={entityTitle} />
      </section>

      {/* "Mes classements" : section à part entière AVANT "À propos" (voir la
          maquette V1.2, §30 dans le fichier source - "son propre panneau,
          pour garder l'ordre fixe"). Vrai contenu Tier Lists (voir
          TierSummarySection ci-dessus, Lot 7). */}
      <TierSummarySection
        entityId={entityId}
        entityTitle={entityTitle}
        entityTypeLabel={entityTypeLabel}
        coverImageUrl={coverImageUrlFrom(entityAttributes)}
      />

      {/* "Assistant" : questions fixes à réponse calculée, entre "Mes
          classements" et "À propos" - emplacement de la maquette V1.2 (voir
          AssistantSection pour ce qui est répondable et ce qui ne l'est
          pas). */}
      <AssistantSection
        entityId={entityId}
        entityTitle={entityTitle}
        variants={variants}
        ownerships={ownerships}
        experiences={experiences}
        activeGroup={activeGroup}
      />


      {/* Surface contextuelle unique (voir la refonte demandée) - remplace
          l'ancien rendu de AddVolumeSection/OwnershipsSection plus bas dans
          la page au clic d'un tome. Un seul panneau, jamais deux visibles. */}
      <VolumeInteractionPanel
        activeTile={activeTile}
        onRenumbered={setActiveVolumeNumber}
        onClose={() => setActiveVolumeNumber(null)}
        entityId={entityId}
        entityTypeId={entityTypeId}
        entityTitle={entityTitle}
        editionName={activeGroup.edition}
        ownerships={ownerships}
      />
    </div>
  )
}
