import { useMutation } from '@tanstack/react-query'
import { CircleCheck, TriangleAlert, Info, CircleX, BookmarkPlus } from 'lucide-react'
import { recordMarketObservation } from '../../api/purchaseAnalysis'
import { ErrorBanner } from '../../components/ErrorBanner'
import type { ItemAnalysisDto, ListingDto, WarningSeverity } from '../../types/purchaseAnalysis'
import { EDITION_TIER_LABELS } from '../../types/purchaseAnalysis'

const WARNING_ICONS: Record<WarningSeverity, typeof Info> = {
  INFO: Info,
  CAUTION: TriangleAlert,
  CRITICAL: CircleX,
}

const WARNING_COLORS: Record<WarningSeverity, string> = {
  INFO: 'text-textDim',
  CAUTION: 'text-warning',
  CRITICAL: 'text-danger',
}

const CONFIDENCE_LABELS = { HIGH: 'haute', MEDIUM: 'moyenne', LOW: 'faible' } as const

/** Détail d'une série au sein d'un lot (obligatoire pour un lot multi-séries,
 * voir l'exemple 20th/21st Century Boys + Sanctuary du cahier des charges) -
 * complétude (✓/⚠️) et avertissements d'édition, avec la distinction
 * observé/théorique toujours visible sur le prix. */
export function SeriesBreakdownItem({
  item,
  listing = null,
  observedAt = null,
}: {
  item: ItemAnalysisDto
  /** L'annonce d'où vient ce lot - plateforme et état pour l'observation de
   * prix ci-dessous. Absente = pas de bouton (voir observationPossible). */
  listing?: ListingDto | null
  /** Date de l'analyse ("YYYY-MM-DD"), pas celle du jour : depuis
   * l'historique, le prix relevé est celui du jour de l'analyse. */
  observedAt?: string | null
}) {
  const { completeness, marketPrice, matchedEdition, editionWarnings, duplicates } = item
  const includedCount = item.item.includedVolumes.length
  const hasDuplicates = duplicates.duplicateVolumeNumbers.length > 0

  // "Prix observé sur N annonces" s'affichait déjà juste en dessous, mais RIEN
  // dans l'app ne savait alimenter ce journal : POST /purchase-analysis/
  // market-observations était livré sans appelant, donc la branche
  // OBSERVED_MARKET du moteur restait inatteignable en usage normal.
  //
  // Les tomes doivent être CONTIGUS : le backend divise le prix relevé par le
  // nombre de tomes de l'intervalle (voir MarketPriceCalculator), donc un lot
  // "1, 2, 5" enregistré en 1-5 donnerait un prix/tome faux. Mieux vaut ne
  // rien proposer que relever un prix erroné.
  const volumes = item.item.includedVolumes
  const contiguous =
    includedCount > 0 && Math.max(...volumes) - Math.min(...volumes) + 1 === includedCount
  const observationPossible =
    matchedEdition !== null && listing !== null && observedAt !== null && contiguous && item.itemCostShare !== null

  const observationMutation = useMutation({
    mutationFn: () =>
      recordMarketObservation({
        mangaEditionId: matchedEdition!.id,
        volumeRangeStart: Math.min(...volumes),
        volumeRangeEnd: Math.max(...volumes),
        // La part du prix TOTAL revenant à ce lot, pas un prix/tome : c'est le
        // backend qui divise par l'intervalle.
        observedPrice: item.itemCostShare!,
        platform: listing!.platform,
        // L'état propre au lot prime sur celui de l'annonce entière, comme
        // partout ailleurs dans le moteur (voir ListingItem.itemConditionOverride).
        observedCondition: item.item.itemConditionOverride ?? listing!.condition,
        observedAt: observedAt!,
        note: listing!.rawTitle,
      }),
  })

  return (
    <div className="flex flex-col gap-2 rounded-xl bg-surface p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-display text-sm font-semibold text-textPrimary">{item.item.series.title}</p>
          <p className="text-xs text-textDim">
            {item.item.editionNameRaw}
            {matchedEdition && ` · ${EDITION_TIER_LABELS[matchedEdition.tier]}`}
          </p>
        </div>
        {item.itemCostShare !== null && (
          <span className="shrink-0 text-xs text-textDim">~{item.itemCostShare.toFixed(2)} €</span>
        )}
      </div>

      {hasDuplicates && (
        <div className="flex flex-col gap-0.5 rounded-lg bg-warning/10 px-2.5 py-1.5 text-xs text-warning">
          <span>
            Tome{duplicates.duplicateVolumeNumbers.length > 1 ? 's' : ''} déjà possédé
            {duplicates.duplicateVolumeNumbers.length > 1 ? 's' : ''} :{' '}
            {[...duplicates.duplicateVolumeNumbers].sort((a, b) => a - b).join(', ')}
          </span>
          <span>
            {duplicates.usefulVolumeCount} tome{duplicates.usefulVolumeCount > 1 ? 's' : ''} utile
            {duplicates.usefulVolumeCount > 1 ? 's' : ''}
            {duplicates.pricePerUsefulVolume !== null && ` · ~${duplicates.pricePerUsefulVolume.toFixed(2)} €/tome utile`}
            {duplicates.maxWorthwhilePrice !== null &&
              ` · reste intéressant jusqu'à ~${duplicates.maxWorthwhilePrice.toFixed(2)} €`}
          </span>
        </div>
      )}

      <div className="flex items-center gap-1.5 text-sm">
        {completeness.totalVolumes !== null ? (
          completeness.missingCount === 0 ? (
            <span className="flex items-center gap-1.5 text-accentText">
              <CircleCheck size={14} />
              Édition complète ({includedCount}/{completeness.totalVolumes} volumes)
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-warning">
              <TriangleAlert size={14} />
              {includedCount}/{completeness.totalVolumes} volumes · {completeness.missingCount} manquant
              {completeness.missingCount! > 1 ? 's' : ''}
              {completeness.estimatedCostToComplete !== null && (
                <span className="text-textDim">
                  {' '}
                  (~{completeness.estimatedCostToComplete.toFixed(2)} €
                  {completeness.costToCompleteBasis === 'OBSERVED_MARKET' && ', marché'}
                  {completeness.costToCompleteBasis === 'AI_ESTIMATED' && ', estimation IA'}
                  {completeness.costToCompleteBasis === 'THEORETICAL_ONLY' && ', théorique'})
                </span>
              )}
            </span>
          )
        ) : (
          <span className="flex items-center gap-1.5 text-textDim">
            <Info size={14} />
            Nombre de tomes total inconnu - complétude non calculable
          </span>
        )}
      </div>

      <div className="flex items-center gap-1.5 text-xs">
        {marketPrice.basis === 'OBSERVED_MARKET' && (
          <span className="rounded-full bg-accent/15 px-2 py-0.5 text-accentText">
            Prix observé sur {marketPrice.observationCount} annonce{marketPrice.observationCount > 1 ? 's' : ''}
            {marketPrice.observedMedian !== null && ` · médiane ${marketPrice.observedMedian.toFixed(2)} €/tome`}
          </span>
        )}
        {marketPrice.basis === 'AI_ESTIMATED' && (
          <span className="rounded-full border border-dashed border-warning px-2 py-0.5 text-warning">
            Estimation IA — non vérifiée
            {marketPrice.aiEstimatedPrice !== null && ` · ${marketPrice.aiEstimatedPrice.toFixed(2)} €/tome`}
            {' '}(confiance {CONFIDENCE_LABELS[marketPrice.confidence]})
          </span>
        )}
        {marketPrice.basis === 'THEORETICAL_ONLY' && (
          <span className="rounded-full border border-dashed border-textDim px-2 py-0.5 text-textDim">
            {marketPrice.theoreticalEstimate !== null
              ? `Estimation théorique · ${marketPrice.theoreticalEstimate.toFixed(2)} €/tome neuf`
              : 'Aucune donnée de prix disponible'}
          </span>
        )}
      </div>

      {/* Rien n'est relevé automatiquement : le prix d'une annonce ne devient
          une donnée de marché que si l'utilisateur le décide, un geste
          explicite (même principe que le garde-fou sur les données IA). */}
      {observationPossible && (
        <div className="text-xs">
          {observationMutation.isSuccess ? (
            <span className="flex items-center gap-1.5 text-textDim">
              <CircleCheck size={13} className="shrink-0" />
              Prix relevé — il comptera dans les prochaines analyses de cette édition.
            </span>
          ) : (
            <button
              type="button"
              onClick={() => observationMutation.mutate()}
              disabled={observationMutation.isPending}
              className="flex items-center gap-1.5 text-textDim underline hover:text-textPrimary disabled:opacity-50"
            >
              <BookmarkPlus size={13} className="shrink-0" />
              {observationMutation.isPending ? 'Enregistrement...' : 'Relever ce prix comme observation de marché'}
            </button>
          )}
          {observationMutation.isError && <ErrorBanner message={observationMutation.error.message} />}
        </div>
      )}

      {/* Plus de filtre sur le texte : le backend n'émet plus l'avertissement
          "doublons" en prose, la même information partant déjà structurée dans
          le bloc dédié ci-dessus (Lot 30). Reconnaître un avertissement à sa
          formulation anglaise n'aurait de toute façon pas survécu à sa
          traduction. Les analyses d'AVANT ce lot, elles, gardent la phrase
          anglaise figée dans leur historique - un instantané, pas un calcul
          rejoué : elle réapparaît donc dans cette liste, à sa place. */}
      {editionWarnings.length > 0 && (
        <ul className="flex flex-col gap-1">
          {editionWarnings.map((warning, index) => {
            const Icon = WARNING_ICONS[warning.severity]
            return (
              <li key={index} className={`flex items-start gap-1.5 text-xs ${WARNING_COLORS[warning.severity]}`}>
                <Icon size={13} className="mt-0.5 shrink-0" />
                <span>{warning.message}</span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
