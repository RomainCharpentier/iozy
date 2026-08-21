import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { deleteEditionUpgradeWish, listAllEditionUpgradeWishes } from '../../api/editionUpgrade'
import { queryKeys } from '../../lib/queryKeys'
import { ErrorBanner } from '../../components/ErrorBanner'

/** "Je possède déjà cette série, mais je recherche une meilleure édition
 * pour la remplacer" - toutes les envies d'amélioration, tous propriétaires
 * confondus (voir EditionUpgradeWishController.all côté backend), même
 * patron que les autres listes de Profil. */
export function EditionUpgradesPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const wishesQuery = useQuery({ queryKey: queryKeys.editionUpgradeWishes.all, queryFn: listAllEditionUpgradeWishes })

  const removeMutation = useMutation({
    mutationFn: deleteEditionUpgradeWish,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.editionUpgradeWishes.all }),
  })

  return (
    <div className="flex flex-col gap-5">
      <h1 className="font-display text-2xl font-bold text-textPrimary">Envies d'amélioration</h1>

      {wishesQuery.isError && <ErrorBanner message={wishesQuery.error.message} />}
      {wishesQuery.isLoading && <p className="text-textDim">Chargement...</p>}
      {wishesQuery.isSuccess && wishesQuery.data.length === 0 && (
        <p className="text-textDim">Aucune envie d'amélioration d'édition pour le moment.</p>
      )}

      <ul className="flex flex-col gap-2">
        {(wishesQuery.data ?? []).map((wish) => (
          <li key={wish.id} className="flex items-center justify-between gap-3 rounded-xl bg-surface p-3">
            <button
              type="button"
              onClick={() => navigate(`/entity/${wish.entityId}`)}
              className="text-left text-sm"
            >
              <p className="font-medium text-textPrimary">{wish.entityTitle}</p>
              <p className="text-textDim">
                Possède {wish.currentEditionName}
                {wish.desiredEditionName && ` → recherche ${wish.desiredEditionName}`}
                {wish.note && ` · ${wish.note}`}
              </p>
            </button>
            <button
              type="button"
              onClick={() => removeMutation.mutate(wish.id)}
              disabled={removeMutation.isPending}
              className="shrink-0 rounded-lg bg-surface2 px-3 py-1.5 text-xs font-medium text-textPrimary disabled:opacity-50"
            >
              Retirer
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
