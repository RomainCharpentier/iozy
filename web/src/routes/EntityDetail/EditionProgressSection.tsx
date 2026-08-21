import { useQuery } from '@tanstack/react-query'
import { AlertTriangle } from 'lucide-react'
import { findEdition, getCompleteness } from '../../api/purchaseAnalysis'
import { queryKeys } from '../../lib/queryKeys'
import { ownedVolumeNumbers, type EditionGroup } from '../../lib/editionGroups'
import { Chip } from '../../components/Chip'
import { EditionCorrectionSection } from './EditionCorrectionSection'
import { EditionUpgradeWishToggle } from './EditionUpgradeWishToggle'
import type { OwnershipResponse, VariantDto } from '../../types/api'

/**
 * Progression + édition, à l'intérieur du bloc Identité (voir la maquette
 * validée - "MangaHero doit contenir : cover / title / author / type /
 * progress / edition selector/info", jamais une section pleine largeur
 * séparée). Sœur de TomesGridSection (grille + à propos, hors du hero) :
 * les deux lisent la MÊME édition active, décidée par le parent
 * (EntityDetailPage - voir activeGroup), et interrogent les mêmes clés de
 * cache purchaseAnalysis (complétude/édition) sans double appel réseau réel,
 * React Query partage la requête entre les deux composants.
 */
export function EditionProgressSection({
  entityId,
  entityTitle,
  variants,
  ownerships,
  displayGroups,
  activeGroup,
  onSelectEdition,
}: {
  entityId: string
  entityTitle: string
  variants: VariantDto[]
  ownerships: OwnershipResponse[]
  displayGroups: EditionGroup[]
  activeGroup: EditionGroup
  onSelectEdition: (edition: string) => void
}) {
  const owned = ownedVolumeNumbers(variants, ownerships, activeGroup.sourceEditions)

  const completenessQuery = useQuery({
    queryKey: queryKeys.purchaseAnalysis.completeness(entityTitle, activeGroup.edition, owned),
    queryFn: () => getCompleteness(entityTitle, activeGroup.edition, owned, activeGroup.volumeNumbers, entityId),
    enabled: activeGroup.edition !== '',
  })

  // Même fiche MangaEdition que "Évaluer un achat" (voir EditionReferenceLookup) -
  // une édition renseignée une fois (épuisée, nouvelle édition annoncée...) le
  // reste partout, jamais ressaisie. 404 = pas encore renseignée, un état
  // normal ici (info facultative en plus, pas un échec).
  const editionInfoQuery = useQuery({
    queryKey: queryKeys.purchaseAnalysis.edition(entityTitle, activeGroup.edition),
    queryFn: () => findEdition(entityTitle, activeGroup.edition, entityId),
    enabled: activeGroup.edition !== '',
    retry: false,
  })
  const editionInfo = editionInfoQuery.isSuccess ? editionInfoQuery.data : null

  const totalVolumes = completenessQuery.data?.totalVolumes ?? null
  const progressPct = totalVolumes !== null && totalVolumes > 0 ? Math.round((owned.length / totalVolumes) * 100) : null

  return (
    <div className="flex flex-col gap-3">
      {/* Une seule ligne répond à "combien j'en ai sur combien" - avant,
          cette même information était éclatée entre une pastille "Possédé"
          globale, un titre de section "Tomes" et un compteur "0 possédé"
          séparé. Barre visuelle en plus (pas seulement du texte) - seulement
          quand un total est connu, jamais une barre à 0% arbitraire sinon.
          Largeur contrainte par le parent (hero-content, max 560px, voir
          EntityDetailPage) : ne doit jamais s'étirer sur toute la largeur du
          container large de la page. */}
      <div>
        <div className="flex items-baseline justify-between gap-3">
          <p className="font-display text-xl font-bold text-textPrimary sm:text-2xl">
            {totalVolumes !== null
              ? `${owned.length} / ${totalVolumes} tomes possédés`
              : `${owned.length} tome${owned.length > 1 ? 's' : ''} possédé${owned.length > 1 ? 's' : ''}`}
          </p>
          {progressPct !== null && <span className="shrink-0 text-sm font-medium text-textDim">{progressPct}%</span>}
        </div>
        {progressPct !== null && (
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-surface2">
            <div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${progressPct}%` }} />
          </div>
        )}
      </div>

      {/* Édition : une ligne compacte pour le cas courant - nom + nombre de
          tomes de CETTE édition sur une seule ligne, l'icône de correction
          directement accrochée plutôt qu'un lien "Modifier l'édition" sur sa
          propre ligne (trop proche d'une interface de gestion). Une seule
          édition pertinente, déjà fusionnée avec les tomes sans édition
          précisée (voir resolveEditionView côté parent). Un vrai sélecteur
          seulement s'il existe un choix réel entre plusieurs éditions
          nommées - jamais un écran à part, juste des chips qui mettent à
          jour la grille en place (voir onSelectEdition). */}
      {displayGroups.length > 1 ? (
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap gap-2">
            {displayGroups.map((g) => (
              <Chip
                key={g.edition || '(non précisée)'}
                label={g.edition || 'Non précisée'}
                isActive={g.edition === activeGroup.edition}
                onClick={() => onSelectEdition(g.edition)}
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

      {/* Avertissements propres à CETTE édition - jamais affichés quand ils
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

      {/* Juste après ces deux avertissements, qui sont précisément ce qui
          déclenche l'envie ("épuisée", "nouvelle édition annoncée") - et
          seulement quand l'édition active porte un nom, voir le composant. */}
      {activeGroup.edition !== '' && (
        <EditionUpgradeWishToggle entityId={entityId} editionName={activeGroup.edition} />
      )}
    </div>
  )
}
