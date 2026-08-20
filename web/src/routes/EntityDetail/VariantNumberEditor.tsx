import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Hash } from 'lucide-react'
import { renumberVariant } from '../../api/entities'
import { queryKeys } from '../../lib/queryKeys'
import { ErrorBanner } from '../../components/ErrorBanner'

/**
 * Renuméroter un Tome - dernière correction de catalogue qui manquait sur une
 * fiche (la jaquette et l'édition étaient déjà rattrapables, pas le numéro,
 * pourtant la donnée la plus facile à se tromper : un tome ajouté à la main
 * ou déduit d'un titre scanné se retrouve vite avec le mauvais numéro).
 * <p>
 * Passe par un endpoint DÉDIÉ, jamais par la fusion d'attributs générique :
 * le numéro et le libellé du Tome doivent bouger ensemble (la déduplication à
 * l'ajout se fait par libellé, voir QuickAddService), et un numéro déjà pris
 * dans la même édition doit être refusé plutôt qu'accepté en double. Les deux
 * règles vivent côté domaine (Entity.renumberVariant), pas ici.
 */
export function VariantNumberEditor({
  entityId,
  variantId,
  volumeNumber,
  onRenumbered,
}: {
  entityId: string
  variantId: string
  volumeNumber: number
  /** Le tome change de place dans la grille : le parent décide quoi faire du
   * panneau ouvert (le suivre plutôt que de le laisser sur un numéro qui
   * n'existe plus). */
  onRenumbered: (newVolumeNumber: number) => void
}) {
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(String(volumeNumber))

  const mutation = useMutation({
    mutationFn: () => renumberVariant(entityId, variantId, Number(value)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.entities.detail(entityId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.entities.all })
      setEditing(false)
      onRenumbered(Number(value))
    },
  })

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => {
          setValue(String(volumeNumber))
          setEditing(true)
        }}
        className="flex w-fit items-center gap-1.5 text-xs text-textDim underline"
      >
        <Hash size={12} />
        Corriger le numéro de tome
      </button>
    )
  }

  const parsed = Number(value)
  const valid = Number.isInteger(parsed) && parsed >= 1

  return (
    <div className="flex flex-col gap-2">
      <label className="text-xs text-textDim" htmlFor="variant-volume-number">
        Numéro de tome
      </label>
      <div className="flex items-center gap-2">
        <input
          id="variant-volume-number"
          type="number"
          min={1}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="w-24 rounded-lg bg-surface2 px-3 py-2 text-sm text-textPrimary focus:outline-none focus:ring-2 focus:ring-accent/50"
        />
        <button
          type="button"
          onClick={() => mutation.mutate()}
          disabled={!valid || parsed === volumeNumber || mutation.isPending}
          className="rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-accentInk disabled:opacity-50"
        >
          {mutation.isPending ? '...' : 'Enregistrer'}
        </button>
        <button type="button" onClick={() => setEditing(false)} className="px-2 py-2 text-xs text-textDim">
          Annuler
        </button>
      </div>
      <p className="text-xs text-textDim">Le libellé du tome suit automatiquement.</p>
      {mutation.isError && <ErrorBanner message={mutation.error.message} />}
    </div>
  )
}
