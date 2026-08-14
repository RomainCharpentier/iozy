import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Trash2 } from 'lucide-react'
import { deleteEntity } from '../../api/entities'
import { queryKeys } from '../../lib/queryKeys'
import { ErrorBanner } from '../../components/ErrorBanner'

/**
 * "Supprimer cette fiche" - seule action de cette page qui soit définitive et
 * irréversible (contrairement à "Marquer vendu"/"Marquer perdu", des
 * changements de statut réversibles) : repliée derrière une confirmation
 * explicite plutôt qu'un simple clic, volontairement en bas de page.
 * <p>
 * Bloquée côté backend tant qu'il existe encore une Ownership OU une
 * Experience rattachée à cette Entity, quel que soit leur statut (voir
 * EntityDeletionService - invariant "une donnée ne disparaît jamais
 * silencieusement") : comme un Ownership existe dès le premier ajout et
 * qu'il n'y a aucun moyen de le supprimer lui-même (seulement de changer son
 * statut), une fiche ayant déjà eu un exemplaire réel reste concrètement
 * indélébile - cette action ne sert en pratique qu'à retirer une fiche créée
 * par erreur puis restée sans aucun exemplaire ni expérience. L'erreur 409
 * renvoyée dans le cas bloqué est affichée telle quelle : elle explique déjà
 * pourquoi (nombre d'Ownership/Experience restants).
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
        className="flex w-fit items-center gap-1.5 text-xs text-danger underline-offset-2 hover:underline"
      >
        <Trash2 size={13} />
        Supprimer cette fiche
      </button>
    )
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl bg-danger/10 p-3">
      <p className="text-sm text-danger">
        Supprimer définitivement « {entityTitle} » ? Cette action est irréversible.
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => deleteMutation.mutate()}
          disabled={deleteMutation.isPending}
          className="rounded-lg bg-danger px-3 py-1.5 text-xs font-semibold text-textPrimary disabled:opacity-50"
        >
          {deleteMutation.isPending ? 'Suppression...' : 'Confirmer la suppression'}
        </button>
        <button
          type="button"
          onClick={() => setConfirmOpen(false)}
          className="rounded-lg px-3 py-1.5 text-xs text-textDim"
        >
          Annuler
        </button>
      </div>
      {deleteMutation.isError && <ErrorBanner message={deleteMutation.error.message} />}
    </div>
  )
}
