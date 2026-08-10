import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { listActiveLoans, markLoanReturned } from '../../api/loans'
import { queryKeys } from '../../lib/queryKeys'
import { ErrorBanner } from '../../components/ErrorBanner'

/** "À qui un manga ou un jeu a été prêté" - tous les prêts en cours, tous
 * propriétaires confondus (voir LoanController.active côté backend). */
export function LoansPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const loansQuery = useQuery({ queryKey: queryKeys.loans.active, queryFn: listActiveLoans })

  const returnMutation = useMutation({
    mutationFn: markLoanReturned,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.loans.active }),
  })

  return (
    <div className="flex flex-col gap-5">
      <h1 className="font-display text-2xl font-bold text-textPrimary">Prêts en cours</h1>

      {loansQuery.isError && <ErrorBanner message={loansQuery.error.message} />}
      {loansQuery.isLoading && <p className="text-textDim">Chargement...</p>}
      {loansQuery.isSuccess && loansQuery.data.length === 0 && (
        <p className="text-textDim">Rien n'est actuellement prêté.</p>
      )}

      <ul className="flex flex-col gap-2">
        {(loansQuery.data ?? []).map((loan) => (
          <li key={loan.id} className="flex items-center justify-between gap-3 rounded-xl bg-surface p-3">
            <button
              type="button"
              onClick={() => navigate(`/entity/${loan.entityId}`)}
              className="text-left text-sm"
            >
              <p className="font-medium text-textPrimary">
                {loan.entityTitle}
                {loan.variantLabel && ` — ${loan.variantLabel}`}
              </p>
              <p className="text-textDim">
                Prêté à {loan.borrowerName} depuis le {loan.lentAt}
                {loan.note && ` · ${loan.note}`}
              </p>
            </button>
            <button
              type="button"
              onClick={() => returnMutation.mutate(loan.id)}
              disabled={returnMutation.isPending}
              className="shrink-0 rounded-lg bg-surface2 px-3 py-1.5 text-xs font-medium text-textPrimary disabled:opacity-50"
            >
              Marquer rendu
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
