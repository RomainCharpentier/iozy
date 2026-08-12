import { useQuery } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { getAnalysisById } from '../../api/purchaseAnalysis'
import { queryKeys } from '../../lib/queryKeys'
import { ErrorBanner } from '../../components/ErrorBanner'
import { PurchaseAnalysisResultCard } from './PurchaseAnalysisResultCard'

/** Une analyse passée précise, revue en entier (même carte de résultat que
 * juste après "ANALYSER LE LOT") - voir AnalysisHistoryPage pour la liste. */
export function AnalysisHistoryDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const analysisQuery = useQuery({
    queryKey: queryKeys.purchaseAnalysis.detail(id!),
    queryFn: () => getAnalysisById(id!),
  })

  return (
    <div className="flex flex-col gap-5">
      <h1 className="font-display text-2xl font-bold text-textPrimary">Analyse du {formatDate(analysisQuery.data?.requestedAt)}</h1>

      {analysisQuery.isError && <ErrorBanner message={analysisQuery.error.message} />}
      {analysisQuery.isLoading && <p className="text-textDim">Chargement...</p>}

      {analysisQuery.data && (
        <PurchaseAnalysisResultCard
          analysis={analysisQuery.data}
          onReset={() => navigate('/purchase-analysis/history')}
          resetLabel="Retour à l'historique"
          resetIcon={ArrowLeft}
        />
      )}
    </div>
  )
}

function formatDate(iso: string | undefined): string {
  if (!iso) return '...'
  return new Date(iso).toLocaleDateString('fr-FR')
}
