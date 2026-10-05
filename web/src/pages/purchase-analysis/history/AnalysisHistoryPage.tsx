import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { History, Trash2 } from 'lucide-react'
import { deleteAnalysis, listAnalysisHistory } from '@/common/api/purchaseAnalysis'
import { queryKeys } from '@/common/lib/queryKeys'
import { ErrorBanner } from '@/common/components/ErrorBanner'
import { VerdictBadge } from '@/pages/purchase-analysis/VerdictBadge'
import { EnTeteSection } from '@/common/components/EnTeteSection'
import { LienRetour } from '@/common/components/LienRetour'
import { formaterEuros } from '@/common/lib/formats'
import { Squelette } from '@/common/components/Squelette'
import { EtatVide } from '@/common/components/EtatVide'

/** "Compare listings" (planned from the initial plan of the Purchase analysis,
 * never built until now) - lists all past analyses (most
 * recent first) to judge a new listing against the
 * previous ones, rather than relying only on the isolated verdict of the moment. */
export function AnalysisHistoryPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const historyQuery = useQuery({ queryKey: queryKeys.purchaseAnalysis.history, queryFn: listAnalysisHistory })

  // An analysis is the frozen result of a calculation: running it again would give a
  // different result (recorded prices and editions may have changed in the meantime), so
  // the deletion is really irreversible - hence a light confirmation
  // rather than a "Annuler" that would restore nothing.
  const deleteMutation = useMutation({
    mutationFn: deleteAnalysis,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.purchaseAnalysis.history })
      setConfirmingId(null)
    },
  })

  const sorted = [...(historyQuery.data ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt))

  return (
    <div className="flex flex-col gap-5">
      <LienRetour parDefaut={{ to: '/purchase-analysis', libelle: 'Analyser une annonce' }} />

      <EnTeteSection niveau={1} titre="Historique des analyses" />

      {historyQuery.isError && <ErrorBanner message={historyQuery.error.message} />}
      {deleteMutation.isError && <ErrorBanner message={deleteMutation.error.message} />}
      {historyQuery.isLoading && <Squelette lignes={3} />}
      {historyQuery.isSuccess && sorted.length === 0 && (
        <EtatVide
          icone={History}
          titre="Aucune analyse enregistrée pour l'instant"
          detail="Depuis « Analyser une annonce », chaque lot analysé vient s'ajouter ici pour comparer une nouvelle annonce aux précédentes."
        />
      )}

      <ul className="flex flex-col gap-2">
        {sorted.map((analysis) => (
          <li key={analysis.id} className="flex flex-col gap-2 rounded-xl bg-surface p-3">
            <div className="flex items-start gap-2">
              <button
                type="button"
                onClick={() => navigate(`/purchase-analysis/history/${analysis.id}`)}
                className="flex min-w-0 flex-1 flex-col gap-2 text-left"
              >
                <div>
                  <p className="font-medium text-textPrimary">{analysis.listingTitle}</p>
                  {analysis.seriesTitles.length > 0 && (
                    <p className="text-xs text-textDim">{analysis.seriesTitles.join(', ')}</p>
                  )}
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <VerdictBadge verdict={analysis.verdict} score={analysis.verdictScore} />
                  <span className="shrink-0 text-sm text-textDim">
                    {formaterEuros(analysis.totalRealCost)} · {new Date(analysis.createdAt).toLocaleDateString('fr-FR')}
                  </span>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setConfirmingId(confirmingId === analysis.id ? null : analysis.id)}
                aria-label={`Supprimer l'analyse ${analysis.listingTitle}`}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-textDim hover:bg-dangerTint hover:text-dangerText"
              >
                <Trash2 size={15} />
              </button>
            </div>

            {confirmingId === analysis.id && (
              <div className="flex flex-wrap items-center gap-2 rounded-lg bg-dangerTint p-2.5">
                <p className="flex-1 text-xs text-textPrimary">
                  Supprimer cette analyse ? Elle ne pourra pas être restaurée. Les prix relevés et les éditions
                  renseignés au fil de cette analyse, eux, sont conservés.
                </p>
                <button
                  type="button"
                  onClick={() => deleteMutation.mutate(analysis.id)}
                  disabled={deleteMutation.isPending}
                  className="rounded-lg bg-danger px-3 py-1.5 text-xs font-semibold text-dangerInk disabled:opacity-50"
                >
                  Confirmer
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingId(null)}
                  className="rounded-lg px-2 py-1.5 text-xs text-textDim"
                >
                  Annuler
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
