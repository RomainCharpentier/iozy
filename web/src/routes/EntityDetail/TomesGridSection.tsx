import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Check, Plus } from 'lucide-react'
import { getCompleteness } from '../../api/purchaseAnalysis'
import { queryKeys } from '../../lib/queryKeys'
import { coverImageUrlFrom } from '../../lib/coverImage'
import { ownedVolumeNumbers, type EditionGroup } from '../../lib/editionGroups'
import { TuileTome, PastilleJeLAi } from './TuileTome'
import { VirtualVolumeCard } from './VirtualVolumeCard'
import { VolumeInteractionPanel } from './VolumeInteractionPanel'
import { AddVolumeSection } from './AddVolumeSection'
import type { OwnershipResponse, VariantDto } from '../../types/api'
import { Jaquette } from '../../components/Jaquette'
import { Chip } from '../../components/Chip'
import { EnTeteSection } from '../../components/EnTeteSection'

export interface TomeTile {
  volumeNumber: number
  status: 'owned' | 'cataloguedMissing' | 'virtualMissing'
  variant?: VariantDto
}

// Aperçu pour les séries longues (voir Naruto, 72 tomes) : au lieu de
// rendre les N tuiles d'un coup, n'en montre qu'un aperçu compact par
// défaut (environ 1 ligne desktop large / 1-2 lignes mobile - 8 tuiles
// tenaient pile sur 1 ligne quand l'échelle plafonnait à xl:grid-cols-8, et
// y tiennent toujours depuis qu'elle monte à 10 puis 12, avec de la place
// pour les possédés situés plus loin ; 2 lignes à grid-cols-4 sur mobile,
// inchangé). Pas de seuil pile sur PREVIEW_TILE_COUNT : en
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
    <TuileTome numero={tile.volumeNumber} etat={owned ? 'owned' : 'missing'} isActive={isActive} onClick={onClick}>
      {/* Catalogué mais manquant : vraie jaquette, atténuée modérément - reste
          identifiable (voir "ne rends pas l'image tellement sombre qu'elle
          devient illisible"), plus de grayscale (désature en plus de l'opacité,
          rendait le tome encore moins reconnaissable qu'une simple atténuation). */}
      <Jaquette
        src={coverUrl}
        className={`absolute inset-0 h-full w-full object-cover ${owned ? '' : 'opacity-40'}`}
        repli={
          <span className="font-display text-2xl font-bold text-handle">
            {String(tile.volumeNumber).padStart(2, '0')}
          </span>
        }
      />
      {owned ? (
        <span className="absolute top-2.5 right-2.5 flex h-6 w-6 items-center justify-center rounded-full bg-accent text-accentInk shadow-token-md">
          <Check size={13} strokeWidth={3} />
        </span>
      ) : (
        <span className="relative">
          <PastilleJeLAi />
        </span>
      )}
    </TuileTome>
  )
}

/**
 * « Mes tomes » : la grille de l'édition affichée, le choix d'édition qui la
 * commande, et les deux parcours d'ajout (contextuel au clic d'une tuile,
 * manuel depuis l'en-tête).
 * <p>
 * Vue directement inspirée de Manga Collec : le possédé/manquant se voit tome
 * par tome, jamais caché dans un compteur (« 5 manquants » ne dit pas
 * LESQUELS). Depuis la maquette v4, chaque tuile porte aussi sa légende - son
 * numéro et son état en toutes lettres - sous la jaquette (voir TuileTome).
 * <p>
 * Interaction Tome : UNE seule source de vérité (`activeVolumeNumber`),
 * jamais plusieurs états indépendants. Le tome sélectionné est recalculé
 * (`activeTile`) à CHAQUE rendu à partir des tuiles fraîchement construites,
 * jamais stocké séparément : après un ajout réussi, la tuile passe seule de
 * « manquant » à « possédé » sans code de transition dédié, voir
 * VolumeInteractionPanel.
 * <p>
 * L'Assistant a quitté cette section pour la barre de sections (voir
 * AssistantSection) : ses questions portent sur la série entière, pas sur la
 * grille.
 */
export function TomesGridSection({
  entityId,
  entityTypeId,
  entityTitle,
  variants,
  ownerships,
  activeGroup,
  displayGroups,
  onSelectEdition,
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
  entityTitle: string
  // Uniquement pour "Statut" dans "À propos" (voir isSeriesOngoing) - le
  // reste de cette section lit déjà ses propres données (editionInfo/
  // completenessQuery), jamais besoin du sac d'attributs complet ailleurs ici.
  variants: VariantDto[]
  ownerships: OwnershipResponse[]
  // Décidée par le parent (EntityDetailPage), qui l'utilise aussi pour
  // l'anneau de progression du hero et le résumé de la barre de sections -
  // tous doivent réagir au même changement d'édition sélectionnée.
  activeGroup: EditionGroup
  // Toutes les éditions affichables de la série (voir resolveEditionView) :
  // les pastilles de choix vivent ICI et non plus dans le hero. Une édition
  // ne change que la GRILLE - la choisir à côté des tomes qu'elle réordonne,
  // plutôt qu'en haut de page à côté du titre, c'est montrer ce qu'elle
  // commande.
  displayGroups: EditionGroup[]
  onSelectEdition: (edition: string) => void
}) {
  const [activeVolumeNumber, setActiveVolumeNumber] = useState<number | null>(null)
  const [showAllTomes, setShowAllTomes] = useState(false)
  // Le formulaire d'ajout manuel est OUVERT d'ici : la maquette v4 pose son
  // déclencheur dans l'en-tête de la section, alors que le formulaire, lui,
  // reste sous les tuiles qu'il complète (voir AddVolumeSection).
  const [ajoutOuvert, setAjoutOuvert] = useState(false)

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
    setAjoutOuvert(false)
  }, [activeGroup.edition, entityId])

  const owned = ownedVolumeNumbers(variants, ownerships, activeGroup.sourceEditions)

  // Mêmes clés de cache que EntityDetailPage et l'Assistant - React Query
  // partage la requête entre eux, jamais un double appel réseau réel pour la
  // même édition active.
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

  const manquants = totalVolumes !== null ? Math.max(totalVolumes - owned.length, 0) : null
  const nomEdition = activeGroup.edition || 'Édition non précisée'
  const resume =
    manquants === null
      ? `${nomEdition} · ${owned.length} tome${owned.length > 1 ? 's' : ''} possédé${owned.length > 1 ? 's' : ''}`
      : `${nomEdition} · ${owned.length} tome${owned.length > 1 ? 's' : ''} possédé${owned.length > 1 ? 's' : ''}, ${manquants} manquant${manquants > 1 ? 's' : ''}`

  return (
    <div className="@container flex flex-col gap-5">
      <EnTeteSection
        titre="Mes tomes"
        sousTitre={resume}
        action={
          <button
            type="button"
            onClick={() => setAjoutOuvert((ouvert) => !ouvert)}
            aria-expanded={ajoutOuvert}
            className="flex min-h-11 items-center gap-2 rounded-[13px] bg-surface px-4 text-sm font-medium text-textPrimary shadow-token-sm"
          >
            <Plus size={15} />
            Ajouter un tome
          </button>
        }
      />

      {/* Le choix d'édition, seulement quand il y a un choix réel : une série
          à une seule édition n'a rien à sélectionner, et une rangée d'une
          pastille unique ressemblerait à un filtre inerte. */}
      {displayGroups.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {displayGroups.map((groupe) => (
            <Chip
              key={groupe.edition || '(non précisée)'}
              label={groupe.edition || 'Non précisée'}
              isActive={groupe.edition === activeGroup.edition}
              onClick={() => onSelectEdition(groupe.edition)}
            />
          ))}
        </div>
      )}

      {/* Plus aucun compte de colonnes au-dela du mobile : `auto-fit` en pose
          autant que la largeur en autorise, a partir de 110px (les tuiles
          portent desormais une legende de deux lignes sous la jaquette, un
          minimum de 96px y coupait « Dans ma collection » a chaque fois).
          C'est ce qui rend cette grille indifferente a l'endroit ou on la met -
          elle a deja vecu dans une colonne aux deux tiers, puis en pleine
          largeur, et a chaque demenagement son compte de colonnes cale sur la
          FENETRE devenait faux : tuiles de 165px sur deux rangees ici, de 71px
          la. Et `auto-fit` fait mieux qu'etre juste : il replie les pistes
          vides, donc six tomes remplissent leur rangee au lieu de la laisser a
          moitie blanche.

          Le maximum est `1fr` et non une valeur fixe : avec un plafond en
          pixels, auto-fit ne remplit pas - mesure, cinq pistes de 140px dans
          832 disponibles, et le sixieme tome renvoye a la ligne pour rien.
          C'est la tuile qui plafonne (max-w-168px), pour qu'une serie de deux
          tomes ne les affiche pas en format affiche.

          Les trois colonnes fixes restent en dessous de @md : sur un telephone,
          quatre jaquettes par rangee ne laissaient pas la place a la legende. */}
      <div className="grid grid-cols-3 gap-x-3 gap-y-4 @md:grid-cols-[repeat(auto-fit,minmax(110px,1fr))] @md:gap-5">
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
          pagination backend, juste le même tableau `tiles` déjà en mémoire,
          tronqué ou non. */}
      {isLongSeries && (
        <button
          type="button"
          onClick={() => setShowAllTomes((v) => !v)}
          className="w-fit text-sm font-medium text-accentText underline"
        >
          {showAllTomes ? 'Réduire' : `Voir tout (${tiles.length})`}
        </button>
      )}

      {/* Parcours manuel (voir AddVolumeSection) : ne devrait plus être
          nécessaire pour un tome déjà visible dans la grille ci-dessus (voir
          le parcours contextuel, VolumeInteractionPanel), seulement pour un
          numéro ou une édition hors de ce qui est déjà catalogué. */}
      <AddVolumeSection
        entityId={entityId}
        entityTypeId={entityTypeId}
        title={entityTitle}
        ouvert={ajoutOuvert}
        onFermer={() => setAjoutOuvert(false)}
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
