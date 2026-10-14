import { useMutation } from '@tanstack/react-query'
import { CircleCheck, TriangleAlert, Info, CircleX, BookmarkPlus } from 'lucide-react'
import { recordMarketObservation } from '@/common/api/purchaseAnalysis'
import { ErrorBanner } from '@/common/components/ErrorBanner'
import { libelleBaseCourt } from '@/common/lib/basePrix'
import type { ItemAnalysisDto, ListingDto, WarningSeverity } from '@/common/types/purchaseAnalysis'
import { EDITION_TIER_LABELS } from '@/common/types/purchaseAnalysis'
import { formaterEuros } from '@/common/lib/formats'

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

/** Detail of a series within a batch (required for a multi-series batch,
 * see the 20th/21st Century Boys + Sanctuary example of the specification) -
 * completeness (✓/⚠️) and edition warnings, with the
 * observed/theoretical distinction always visible on the price. */
export function SeriesBreakdownItem({
  item,
  listing = null,
  observedAt = null,
}: {
  item: ItemAnalysisDto
  /** The listing this batch comes from - platform and condition for the observation of
   * price below. Missing = no button (see observationPossible). */
  listing?: ListingDto | null
  /** Date of the analysis ("YYYY-MM-DD"), not today's: from
   * the history, the recorded price is the one of the day of the analysis. */
  observedAt?: string | null
}) {
  const { completeness, marketPrice, matchedEdition, editionWarnings, duplicates } = item
  const includedCount = item.item.includedVolumes.length
  const hasDuplicates = duplicates.duplicateVolumeNumbers.length > 0

  // "Prix observé sur N annonces" was already displayed right below, but NOTHING
  // in the app could feed this log: POST /purchase-analysis/
  // market-observations was shipped with no caller, so the
  // OBSERVED_MARKET branch of the engine stayed unreachable in normal use.
  //
  // The volumes must be CONTIGUOUS: the backend divides the recorded price by the
  // number of volumes of the range (see MarketPriceCalculator), so a batch
  // "1, 2, 5" saved as 1-5 would give a wrong price per volume. Better to
  // offer nothing than to record a wrong price.
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
        // The share of the TOTAL price going to this batch, not a price per volume: the
        // backend divides by the range.
        observedPrice: item.itemCostShare!,
        platform: listing!.platform,
        // The condition specific to the batch takes priority over the one of the whole listing, as
        // everywhere else in the engine (see ListingItem.itemConditionOverride).
        observedCondition: item.item.itemConditionOverride ?? listing!.condition,
        observedAt: observedAt!,
        note: listing!.rawTitle,
      }),
  })

  const baseCoutRestant = libelleBaseCourt(completeness.costToCompleteBasis)

  // Completeness counts what the user would hold after buying: the lot plus the volumes
  // they already own (the server adds them since 2026-10). The owned share is what the
  // edition covers beyond the lot. An analysis saved before counted the lot alone: there
  // the share is zero and the line reads exactly as it did then.
  const total = completeness.totalVolumes
  const includedInEdition = total === null ? 0 : volumes.filter((v) => v >= 1 && v <= total).length
  const covered = total === null || completeness.missingCount === null ? 0 : total - completeness.missingCount
  const ownedOutsideLot = Math.max(0, covered - includedInEdition)

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
          <span className="shrink-0 text-xs text-textDim">~{formaterEuros(item.itemCostShare)}</span>
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
            {duplicates.pricePerUsefulVolume !== null && ` · ~${formaterEuros(duplicates.pricePerUsefulVolume)}/tome utile`}
            {duplicates.maxWorthwhilePrice !== null &&
              ` · reste intéressant jusqu'à ~${formaterEuros(duplicates.maxWorthwhilePrice)}`}
          </span>
        </div>
      )}

      <div className="flex items-center gap-1.5 text-sm">
        {completeness.totalVolumes !== null ? (
          completeness.missingCount === 0 ? (
            <span className="flex items-center gap-1.5 text-accentText">
              <CircleCheck size={14} />
              {ownedOutsideLot > 0
                ? `Édition complète avec ce lot (${includedInEdition} dans le lot + ${ownedOutsideLot} déjà possédé${ownedOutsideLot > 1 ? 's' : ''})`
                : `Édition complète (${includedCount}/${completeness.totalVolumes} volumes)`}
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-warning">
              <TriangleAlert size={14} />
              {ownedOutsideLot > 0
                ? `${covered}/${completeness.totalVolumes} volumes avec ce lot et ta collection`
                : `${includedCount}/${completeness.totalVolumes} volumes`}{' '}
              · {completeness.missingCount} manquant
              {completeness.missingCount! > 1 ? 's' : ''}
              {completeness.estimatedCostToComplete !== null && (
                <span className="text-textDim">
                  {' '}
                  (~{formaterEuros(completeness.estimatedCostToComplete)}
                  {baseCoutRestant === null ? ')' : `, ${baseCoutRestant})`}
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
            {/* This count is the one of RECORDS, not listings: the same
                offer followed over time appears several times in it. The number
                of independent listings is the one of the Prix section, which groups
                them. Calling them "annonces" here would inflate the sample
                in the reader's eyes. */}
            Prix observé sur {marketPrice.observationCount} relevé{marketPrice.observationCount > 1 ? 's' : ''}
            {marketPrice.observedMedian !== null && ` · médiane ${formaterEuros(marketPrice.observedMedian)}/tome`}
          </span>
        )}
        {marketPrice.basis === 'AI_ESTIMATED' && (
          <span className="rounded-full border border-dashed border-warning px-2 py-0.5 text-warning">
            Estimation IA — non vérifiée
            {marketPrice.aiEstimatedPrice !== null && ` · ${formaterEuros(marketPrice.aiEstimatedPrice)}/tome`}
            {' '}(confiance {CONFIDENCE_LABELS[marketPrice.confidence]})
          </span>
        )}
        {marketPrice.basis === 'THEORETICAL_ONLY' && (
          <span className="rounded-full border border-dashed border-textDim px-2 py-0.5 text-textDim">
            {marketPrice.theoreticalEstimate !== null
              ? `Estimation théorique · ${formaterEuros(marketPrice.theoreticalEstimate)}/tome neuf`
              : 'Aucune donnée de prix disponible'}
          </span>
        )}
      </div>

      {/* The explicit action: it is THIS that makes a price enter the market
          data, and it stays the only path for a listing entered by hand
          - that is, the normal case, no public provider existing.
          (A listing read from a link carries an identity: its price is
          recorded automatically, because only there does the engine know how to
          recognise two analyses of the same listing and exclude it from its own
          reference. See releverLePrixDemande on the server.) */}
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
              className="flex min-h-11 items-center gap-1.5 text-textDim underline hover:text-textPrimary disabled:opacity-50"
            >
              <BookmarkPlus size={13} className="shrink-0" />
              {observationMutation.isPending ? 'Enregistrement...' : 'Relever ce prix comme observation de marché'}
            </button>
          )}
          {observationMutation.isError && <ErrorBanner message={observationMutation.error.message} />}
        </div>
      )}

      {/* No more filter on the text: the backend no longer emits the
          "doublons" warning in prose, the same information already leaving structured in
          the dedicated block above (Batch 30). Recognising a warning by its
          English wording would not have survived its
          translation anyway. The analyses from BEFORE this batch keep the
          English sentence frozen in their history - a snapshot, not a calculation
          replayed: it therefore reappears in this list, in its place. */}
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
