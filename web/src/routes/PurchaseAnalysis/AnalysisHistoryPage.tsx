import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { listAnalysisHistory } from '../../api/purchaseAnalysis'
import { queryKeys } from '../../lib/queryKeys'
import { ErrorBanner } from '../../components/ErrorBanner'
import { VerdictBadge } from './VerdictBadge'

/** "Comparer les annonces" (prévu dès le plan initial de l'Analyse d'achat,
 * jamais construit jusqu'ici) - liste toutes les analyses passées (les plus
 * récentes d'abord) pour juger une nouvelle annonce à l'aune des
 * précédentes, plutôt que de se fier uniquement au verdict isolé du moment. */
export function AnalysisHistoryPage() {
  const navigate = useNavigate()
  const historyQuery = useQuery({ queryKey: queryKeys.purchaseAnalysis.history, queryFn: listAnalysisHistory })

  const sorted = [...(historyQuery.data ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt))

  return (
    <div className="flex flex-col gap-5">
      <h1 className="font-display text-2xl font-bold text-textPrimary">Historique des analyses</h1>

      {historyQuery.isError && <ErrorBanner message={historyQuery.error.message} />}
      {historyQuery.isLoading && <p className="text-textDim">Chargement...</p>}
      {historyQuery.isSuccess && sorted.length === 0 && (
        <p className="text-textDim">
          Aucune analyse enregistrée pour l'instant - depuis "Évaluer un achat", chaque lot analysé vient s'ajouter
          ici pour comparer une nouvelle annonce aux précédentes.
        </p>
      )}

      <ul className="flex flex-col gap-2">
        {sorted.map((analysis) => (
          <li key={analysis.id}>
            <button
              type="button"
              onClick={() => navigate(`/purchase-analysis/history/${analysis.id}`)}
              className="flex w-full flex-col gap-2 rounded-xl bg-surface p-3 text-left"
            >
              <div>
                <p className="font-medium text-textPrimary">{analysis.listingTitle}</p>
                {analysis.seriesTitles.length > 0 && (
                  <p className="text-xs text-textDim">{analysis.seriesTitles.join(', ')}</p>
                )}
              </div>
              <div className="flex items-center justify-between gap-2">
                <VerdictBadge verdict={analysis.verdict} score={analysis.verdictScore} />
                <span className="shrink-0 text-sm text-textDim">
                  {analysis.totalRealCost.toFixed(2)} € · {new Date(analysis.createdAt).toLocaleDateString('fr-FR')}
                </span>
              </div>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
