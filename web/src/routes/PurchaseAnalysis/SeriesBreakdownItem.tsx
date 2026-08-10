import { CircleCheck, TriangleAlert, Info, CircleX } from 'lucide-react'
import type { ItemAnalysisDto, WarningSeverity } from '../../types/purchaseAnalysis'
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

/** Détail d'une série au sein d'un lot (obligatoire pour un lot multi-séries,
 * voir l'exemple 20th/21st Century Boys + Sanctuary du cahier des charges) -
 * complétude (✓/⚠️) et avertissements d'édition, avec la distinction
 * observé/théorique toujours visible sur le prix. */
export function SeriesBreakdownItem({ item }: { item: ItemAnalysisDto }) {
  const { completeness, marketPrice, matchedEdition, editionWarnings } = item
  const includedCount = item.item.includedVolumes.length

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

      <div className="flex items-center gap-1.5 text-sm">
        {completeness.totalVolumes !== null ? (
          completeness.missingCount === 0 ? (
            <span className="flex items-center gap-1.5 text-accent">
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
                  {completeness.costToCompleteBasis === 'THEORETICAL_ONLY' ? ', théorique' : ', marché'})
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
        {marketPrice.basis === 'OBSERVED_MARKET' ? (
          <span className="rounded-full bg-accent/15 px-2 py-0.5 text-accent">
            Prix observé sur {marketPrice.observationCount} annonce{marketPrice.observationCount > 1 ? 's' : ''}
            {marketPrice.observedMedian !== null && ` · médiane ${marketPrice.observedMedian.toFixed(2)} €/tome`}
          </span>
        ) : (
          <span className="rounded-full border border-dashed border-textDim px-2 py-0.5 text-textDim">
            {marketPrice.theoreticalEstimate !== null
              ? `Estimation théorique · ${marketPrice.theoreticalEstimate.toFixed(2)} €/tome neuf`
              : 'Aucune donnée de prix disponible'}
          </span>
        )}
      </div>

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
