import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Trash2 } from 'lucide-react'
import { deleteEntity } from '@/common/api/entities'
import { queryKeys } from '@/common/lib/queryKeys'
import { ErrorBanner } from '@/common/components/ErrorBanner'

/**
 * "Supprimer cette fiche" - the only action of this page that is final and
 * irreversible (unlike "Marquer vendu"/"Marquer perdu", which are reversible
 * status changes): folded behind an explicit confirmation
 * rather than a simple click, deliberately at the bottom of the page.
 * <p>
 * Blocked on the backend side as long as an Ownership OR an
 * Experience is still attached to this Entity, whatever their status (see
 * EntityDeletionService - invariant "data never disappears
 * silently"): since an Ownership exists from the first add and
 * there is no way to delete it itself (only to change its
 * status), a page that ever had a real copy stays practically
 * undeletable - in practice this action only serves to remove a page created
 * by mistake and left with no copy or experience. The 409 error
 * returned in the blocked case is displayed as is: it already explains
 * why (number of remaining Ownership/Experience).
 */
export function DeleteEntitySection({ entityId, entityTitle }: { entityId: string; entityTitle: string }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [confirmOpen, setConfirmOpen] = useState(false)

  const deleteMutation = useMutation({
    mutationFn: () => deleteEntity(entityId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.entities.all })
      navigate('/')
    },
  })

  if (!confirmOpen) {
    return (
      <button
        type="button"
        onClick={() => setConfirmOpen(true)}
        className="flex w-fit items-center gap-2 rounded-xl border border-danger/35 px-3.5 py-2.5 text-[13.5px] font-medium text-dangerText hover:border-dangerText hover:bg-dangerText hover:text-dangerInk"
      >
        <Trash2 size={14} />
        Supprimer
      </button>
    )
  }

  return (
    <div className="flex flex-col gap-2.5">
      <p className="text-sm text-dangerText">
        Supprimer définitivement « {entityTitle} » ? Cette action est irréversible.
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => deleteMutation.mutate()}
          disabled={deleteMutation.isPending}
          className="rounded-xl bg-danger px-3.5 py-2.5 text-[13px] font-semibold text-dangerInk disabled:opacity-50"
        >
          {deleteMutation.isPending ? 'Suppression...' : 'Confirmer la suppression'}
        </button>
        <button
          type="button"
          onClick={() => setConfirmOpen(false)}
          className="rounded-xl px-3.5 py-2.5 text-[13px] text-textDim"
        >
          Annuler
        </button>
      </div>
      {deleteMutation.isError && <ErrorBanner message={deleteMutation.error.message} />}
    </div>
  )
}
