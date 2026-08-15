import { Fragment, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, Check, Plus } from 'lucide-react'
import { findEdition, getCompleteness } from '../../api/purchaseAnalysis'
import { queryKeys } from '../../lib/queryKeys'
import { coverImageUrlFrom } from '../../lib/coverImage'
import { isSeriesOngoing } from '../../lib/seriesInfo'
import { groupVariantsByEdition, ownedVolumeNumbers, resolveEditionView, type EditionGroup } from '../../lib/editionGroups'
import { Chip } from '../../components/Chip'
import { EditionCorrectionSection } from './EditionCorrectionSection'
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
      className={`relative flex aspect-[2/3] flex-col items-center justify-center overflow-hidden rounded-lg text-left ${
        owned ? 'bg-surface2' : tile.status === 'virtualMissing' ? 'border border-dashed border-surface2 bg-surface2/30' : 'bg-surface2/50'
      }`}
    >
      {coverUrl ? (
        // Catalogué mais manquant : vraie jaquette, atténuée modérément - reste
        // identifiable (voir "ne rends pas l'image tellement sombre qu'elle
        // devient illisible"), plus de grayscale (désature en plus de l'opacité,
        // rendait le tome encore moins reconnaissable qu'une simple atténuation).
        <img src={coverUrl} alt="" className={`absolute inset-0 h-full w-full object-cover ${owned ? '' : 'opacity-55'}`} />
      ) : owned ? (
        <span className="font-display text-base font-semibold text-textPrimary">{tile.volumeNumber}</span>
      ) : (
        // Tome virtuel (aucune couverture connue) : un vrai placeholder visuel
        // ("Tome 3 / Manquant"), pas un simple rectangle avec un numéro nu -
        // l'utilisateur doit comprendre "cette place correspond au tome que je
        // ne possède pas encore", jamais un vocabulaire technique (voir
        // TomeTile.status, qui reste un détail d'implémentation jamais affiché).
        <span className="flex flex-col items-center gap-0.5 px-1 text-center">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-textDim">Tome {tile.volumeNumber}</span>
          <span className="text-[10px] text-textDim/70">Manquant</span>
        </span>
      )}
      {owned ? (
        <span className="absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-accentText">
          <Check size={11} strokeWidth={3} />
        </span>
      ) : (
        <span className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-0.5 bg-black/55 py-0.5 text-[10px] font-medium text-textPrimary">
          <Plus size={9} />
          {/* Le numéro n'apparaît qu'une fois dans le badge : seulement quand le
              centre de la tuile est occupé par une vraie jaquette (sinon "Tome N"
              y figure déjà, pas la peine de le répéter). */}
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
  entityId,
  entityTitle,
  entityAttributes,
  variants,
  ownerships,
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
    queryFn: () => getCompleteness(entityTitle, activeGroup.edition, owned, activeGroup.volumeNumbers, entityId),
    enabled: activeGroup.edition !== '',
  })

  // Même fiche MangaEdition que "Évaluer un achat" (voir EditionReferenceLookup) -
  // une édition renseignée une fois (épuisée, nouvelle édition annoncée...) le
  // reste partout, jamais ressaisie. 404 = pas encore renseignée, un état
  // normal ici (info facultative en plus, pas un échec) - jamais affiché comme
  // une erreur, contrairement à completenessQuery qui porte le compteur
  // principal de la page.
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
  const progressPct = totalVolumes !== null && totalVolumes > 0 ? Math.round((owned.length / totalVolumes) * 100) : null
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
    <section className="flex flex-col gap-3">
      {/* Une seule ligne répond à "combien j'en ai sur combien" - avant,
          cette même information était éclatée entre une pastille "Possédé"
          globale, un titre de section "Tomes" et un compteur "0 possédé"
          séparé (voir audit "informations redondantes"). Barre visuelle en
          plus (pas seulement du texte, voir la maquette validée) - seulement
          quand un total est connu, jamais une barre à 0% arbitraire sinon. */}
      <div>
        <p className="font-display text-2xl font-bold text-textPrimary">
          {totalVolumes !== null
            ? `${owned.length} / ${totalVolumes} tomes possédés`
            : `${owned.length} tome${owned.length > 1 ? 's' : ''} possédé${owned.length > 1 ? 's' : ''}`}
        </p>
        {progressPct !== null && (
          <div className="mt-2 flex items-center gap-2.5">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface2">
              <div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${progressPct}%` }} />
            </div>
            <span className="shrink-0 text-sm font-medium text-textDim">{progressPct}%</span>
          </div>
        )}
      </div>

      {/* Édition : une ligne compacte pour le cas courant - nom + nombre de
          tomes de CETTE édition sur une seule ligne, l'icône de correction
          directement accrochée plutôt qu'un lien "Modifier l'édition" sur sa
          propre ligne (voir EditionCorrectionSection - trop proche d'une
          interface de gestion, voir la maquette validée). Une seule édition
          pertinente, déjà fusionnée avec les tomes sans édition précisée
          (voir resolveEditionView). Un vrai sélecteur seulement s'il existe un
          choix réel entre plusieurs éditions nommées - jamais un écran à part,
          juste des chips qui mettent à jour la grille en place. */}
      {displayGroups.length > 1 ? (
        <div className="flex flex-col gap-1.5">
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
          {activeGroup.edition !== '' && (
            <div className="flex flex-wrap items-center gap-1.5">
              {totalVolumes !== null && <span className="text-sm text-textDim">{totalVolumes} tomes</span>}
              <EditionCorrectionSection entityId={entityId} entityTitle={entityTitle} editionName={activeGroup.edition} editionInfo={editionInfo} />
            </div>
          )}
        </div>
      ) : (
        activeGroup.edition !== '' && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-sm text-textDim">
              {activeGroup.edition}
              {totalVolumes !== null && ` · ${totalVolumes} tomes`}
            </span>
            <EditionCorrectionSection entityId={entityId} entityTitle={entityTitle} editionName={activeGroup.edition} editionInfo={editionInfo} />
          </div>
        )
      )}

      {/* Avertissements propres à CETTE édition (même donnée que "Évaluer un
          achat", voir editionInfoQuery ci-dessus) - jamais affichés quand ils
          ne s'appliquent pas ("pas épuisée" ne mérite pas une ligne, seul un
          fait notable en mérite une). Change avec l'édition active : une
          Perfect Edition annoncée ne concerne que l'édition standard, pas
          elle-même. */}
      {editionInfo?.outOfPrint && (
        <p className="flex items-center gap-1.5 text-xs text-warning">
          <AlertTriangle size={12} className="shrink-0" />
          Cette édition est épuisée
        </p>
      )}
      {editionInfo?.betterEditionAnnounced && (
        <p className="flex items-center gap-1.5 text-xs text-warning">
          <AlertTriangle size={12} className="shrink-0" />
          Nouvelle édition annoncée{editionInfo.betterEditionNote ? ` · ${editionInfo.betterEditionNote}` : ''}
        </p>
      )}

      {/* "Mes tomes" devient la zone principale de la fiche (voir la maquette
          validée) - titre explicite, plus de colonnes que Ma Collection (moins
          de texte par tuile, une série peut compter de nombreux tomes) pour
          exploiter le container élargi (voir AppShell.isWideScreen) sans
          revenir à l'ancien extrême illisible (10 colonnes fixes). */}
      <h2 className="font-display text-lg font-semibold text-textPrimary">Mes tomes</h2>
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-7 xl:grid-cols-8 2xl:grid-cols-9">
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

      {/* "À propos" : bloc compact, secondaire par rapport aux tomes (voir la
          maquette validée) - uniquement des données réellement connues,
          jamais une valeur artificielle pour remplir la section (aucune ligne
          "Genre"/"Thèmes" ici : ni Jikan ni MyAnimeList ne sont exploités pour
          ces champs dans ce backend aujourd'hui, les afficher inventerait une
          donnée). Absente entièrement si rien n'est connu - pas la peine
          d'une section vide. */}
      {aboutRows.length > 0 && (
        <section className="flex flex-col gap-2 border-t border-surface pt-3">
          <h2 className="font-display text-lg font-semibold text-textPrimary">À propos</h2>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
            {aboutRows.map(([label, value]) => (
              <Fragment key={label}>
                <dt className="text-textDim">{label}</dt>
                <dd className="text-textPrimary">{value}</dd>
              </Fragment>
            ))}
          </dl>
        </section>
      )}
    </section>
  )
}
