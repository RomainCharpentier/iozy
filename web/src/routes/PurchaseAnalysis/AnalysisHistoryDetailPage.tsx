import { useQuery } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { getAnalysisById } from '../../api/purchaseAnalysis'
import { queryKeys } from '../../lib/queryKeys'
import { ErrorBanner } from '../../components/ErrorBanner'
import { PurchaseAnalysisResultCard } from './PurchaseAnalysisResultCard'
import { EnTeteSection } from '../../components/EnTeteSection'
import { LienRetour } from '../../components/LienRetour'

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
      <LienRetour parDefaut={{ to: '/purchase-analysis/history', libelle: 'Historique des analyses' }} />

      <EnTeteSection niveau={1} titre={`Analyse du ${formatDate(analysisQuery.data?.requestedAt)}`} />

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
