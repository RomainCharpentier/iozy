import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getPreferences, updatePreferences } from '@/common/api/purchaseAnalysis'
import { queryKeys } from '@/common/lib/queryKeys'
import type { CollectorPreferencesDto } from '@/common/types/purchaseAnalysis'

/**
 * The two collector preferences that the verdict really reads and that a person
 * can judge alone: the minimum discount against the new price, and whether an
 * outdated edition should be avoided. The other fields (factor weights, edition
 * ranking) stay at their defaults; the PATCH replaces the whole profile, so the
 * fetched object is sent back with only these two fields changed.
 */
export function PreferencesSection() {
  const preferencesQuery = useQuery({
    queryKey: queryKeys.purchaseAnalysis.preferences,
    queryFn: getPreferences,
  })

  return (
    <details className="border-t border-ligneVerre pt-4">
      <summary className="cursor-pointer text-sm font-medium text-textPrimary">Ce qui compte pour toi</summary>
      {preferencesQuery.isPending && <p className="mt-3 text-sm text-textDim">Chargement…</p>}
      {preferencesQuery.isError && (
        <p className="mt-3 text-sm text-dangerText" role="alert">
          Impossible de lire tes réglages : l'analyse utilise les réglages par défaut.
        </p>
      )}
      {preferencesQuery.data && <PreferencesForm saved={preferencesQuery.data} />}
    </details>
  )
}

function PreferencesForm({ saved }: { saved: CollectorPreferencesDto }) {
  const queryClient = useQueryClient()
  const [discount, setDiscount] = useState(String(saved.minimumDiscountVsRetailPercent))
  const [avoidOutdated, setAvoidOutdated] = useState(saved.avoidOutdatedEditionWhenBetterExistsOrAnnounced)

  const discountValue = Number(discount)
  const discountValid = discount.trim() !== '' && Number.isInteger(discountValue) && discountValue >= 0 && discountValue <= 100
  const changed =
    discountValue !== saved.minimumDiscountVsRetailPercent ||
    avoidOutdated !== saved.avoidOutdatedEditionWhenBetterExistsOrAnnounced

  const saveMutation = useMutation({
    mutationFn: () =>
      updatePreferences({
        ...saved,
        minimumDiscountVsRetailPercent: discountValue,
        avoidOutdatedEditionWhenBetterExistsOrAnnounced: avoidOutdated,
      }),
    onSuccess: (updated) => {
      queryClient.setQueryData(queryKeys.purchaseAnalysis.preferences, updated)
    },
  })

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        saveMutation.mutate()
      }}
      className="mt-3 flex flex-col gap-3"
    >
      <p className="text-xs text-textDim">Ces réglages pèsent sur le verdict des prochaines analyses.</p>
      <label className="flex flex-col gap-1 text-sm text-textDim">
        Remise minimale sur le prix neuf (%)
        <input
          type="number"
          inputMode="numeric"
          min={0}
          max={100}
          step={1}
          value={discount}
          onChange={(e) => setDiscount(e.target.value)}
          className="champ w-28"
          aria-invalid={!discountValid}
        />
      </label>
      {!discountValid && <p className="text-xs text-dangerText">Indique un nombre entier entre 0 et 100.</p>}
      <label className="flex items-center gap-2 text-sm text-textDim">
        <input
          type="checkbox"
          checked={avoidOutdated}
          onChange={(e) => setAvoidOutdated(e.target.checked)}
          className="accent-accent"
        />
        Éviter une édition dépassée quand une meilleure existe ou est annoncée
      </label>
      <button
        type="submit"
        disabled={!changed || !discountValid || saveMutation.isPending}
        className="btn-secondaire self-start"
      >
        {saveMutation.isPending ? 'Enregistrement…' : 'Enregistrer'}
      </button>
      {saveMutation.isError && (
        <p className="text-xs text-dangerText" role="alert">
          L'enregistrement a échoué : tes réglages n'ont pas changé.
        </p>
      )}
      {saveMutation.isSuccess && !changed && (
        <p className="text-xs text-textDim" role="status">
          Réglages enregistrés.
        </p>
      )}
    </form>
  )
}
