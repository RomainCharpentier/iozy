import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Trash2 } from 'lucide-react'
import { deleteAnalysis, listAnalysisHistory } from '@/common/api/purchaseAnalysis'
import { queryKeys } from '@/common/lib/queryKeys'
import { ErrorBanner } from '@/common/components/ErrorBanner'
import { VerdictBadge } from '@/pages/purchase-analysis/VerdictBadge'
import { EnTeteSection } from '@/common/components/EnTeteSection'
import { LienRetour } from '@/common/components/LienRetour'
import { formaterEuros } from '@/common/lib/formats'

/** "Comparer les annonces" (prévu dès le plan initial de l'Analyse d'achat,
 * jamais construit jusqu'ici) - liste toutes les analyses passées (les plus
 * récentes d'abord) pour juger une nouvelle annonce à l'aune des
 * précédentes, plutôt que de se fier uniquement au verdict isolé du moment. */
export function AnalysisHistoryPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const historyQuery = useQuery({ queryKey: queryKeys.purchaseAnalysis.history, queryFn: listAnalysisHistory })

  // Une analyse est le résultat figé d'un calcul : la relancer donnerait un
  // autre résultat (prix relevés et éditions ont pu changer entre-temps), donc
  // la suppression est réellement irréversible - d'où une confirmation légère
  // plutôt qu'un « Annuler » qui ne restaurerait rien.
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
      {historyQuery.isLoading && <p className="text-textDim">Chargement...</p>}
      {historyQuery.isSuccess && sorted.length === 0 && (
        <p className="text-textDim">
          Aucune analyse enregistrée pour l'instant - depuis "Analyser une annonce", chaque lot analysé vient s'ajouter
          ici pour comparer une nouvelle annonce aux précédentes.
        </p>
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
