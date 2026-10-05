import { useQuery } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { getAnalysisById } from '@/common/api/purchaseAnalysis'
import { queryKeys } from '@/common/lib/queryKeys'
import { ErrorBanner } from '@/common/components/ErrorBanner'
import { PurchaseAnalysisResultCard } from '@/pages/purchase-analysis/PurchaseAnalysisResultCard'
import { EnTeteSection } from '@/common/components/EnTeteSection'
import { LienRetour } from '@/common/components/LienRetour'
import { Squelette } from '@/common/components/Squelette'

/** One specific past analysis, reviewed in full (same result card as
 * right after "ANALYSER LE LOT") - see AnalysisHistoryPage for the list. */
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
      {analysisQuery.isLoading && <Squelette lignes={3} />}

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
