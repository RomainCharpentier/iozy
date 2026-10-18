import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { quickAdd } from '@/common/api/entities'
import { ErrorBanner } from '@/common/components/ErrorBanner'
import { invaliderApresPossession } from '@/common/lib/invalidations'

interface ManualVolume {
  volumeNumber: number
  edition: string
}

/**
 * MANUAL path (see the volume grid for the
 * CONTEXTUAL path, started from a click on a tile that is already visible -
 * the two are deliberately separate, see "two ways to add"): for
 * a volume that does not appear in the grid yet (number/edition outside
 * what is already known). Completes an edition already in the collection with one or
 * more missing volumes (e.g. volumes 4 and 5 of a "Black Edition"
 * never found by the automatic search on the BnF/Google Books side - a gap
 * in the source data, not a bug, see the conversation history on
 * "Death Note").
 * <p>
 * `quickAdd` already matches an existing Entity by (entityTypeId, title) on the
 * backend side (see QuickAddService) - it is enough to reuse the exact title of
 * the series already in the collection, no new endpoint is needed.
 * <p>
 * Same queue mechanism as QuickAddPage.tsx (see
 * queueManualVolume) - it lets you chain several volumes before confirming
 * once, the edition staying pre-filled from one volume to the next. It stays
 * deliberately more complete than a click on a tile (number AND edition to
 * enter, several volumes at once): the manual path has by definition
 * no known context to reuse.
 */
export function AddVolumeSection({
  entityId,
  entityTypeId,
  title,
  attributes,
  ouvert,
  onFermer,
  onAjoute,
}: {
  /** Absent from a preview: the work has no detail page yet, `quickAdd`
   *  will create it. Only used to refresh the caches of the current page. */
  entityId?: string
  entityTypeId: string
  title: string
  /** Copied onto the created Entity. Essential from a preview: without them
   *  the page would be born without a cover or author - same trap as in Batch 32. */
  attributes?: Record<string, unknown>
  /** Open/closed state decided by "Mes tomes": mockup v4 puts the
   *  "Ajouter un tome" trigger in the section header, not under the
   *  grid - the form itself stays here, under the tiles it completes. */
  ouvert: boolean
  onFermer: () => void
  /** Called with the id of the detail page after a successful add - this is what
   *  lets a preview switch to the page that was just born. */
  onAjoute?: (entityId: string) => void
}) {
  const queryClient = useQueryClient()
  const [volumeNumber, setVolumeNumber] = useState('')
  const [edition, setEdition] = useState('')
  const [manualVolumes, setManualVolumes] = useState<ManualVolume[]>([])

  const totalVolumesToAdd = manualVolumes.length + (volumeNumber.trim() ? 1 : 0)

  const addMutation = useMutation({
    mutationFn: async () => {
      const items = [...manualVolumes]
      const trimmedVolumeNumber = volumeNumber.trim()
      if (trimmedVolumeNumber) {
        items.push({ volumeNumber: Number(trimmedVolumeNumber), edition: edition.trim() })
      }
      if (items.length === 0) return { addedCount: 0, alreadyOwnedCount: 0 }


      let addedCount = 0
      let alreadyOwnedCount = 0
      let identifiant = entityId
      // Sequential: see QuickAddPage.tsx for the same precaution (the Entity
      // already exists here, but one Variant to create per call is still safer
      // than a Promise.all in case of a partial error).
      for (const item of items) {
        const result = await quickAdd({
          entityTypeId,
          title,
          // Adding takes one click: no condition or price asked here, both can be
          // fixed later on the copy (see OwnershipDetails).
          condition: 'NEW',
          attributes,
          volumeNumber: item.volumeNumber,
          edition: item.edition || undefined,
        })
        identifiant = result.entityId
        if (result.matchedExistingVariant) alreadyOwnedCount++
        else addedCount++
      }
      return { addedCount, alreadyOwnedCount, entityId: identifiant }
    },
    onSuccess: (resultat) => {
      invaliderApresPossession(queryClient)
      if (resultat.entityId) onAjoute?.(resultat.entityId)
      setVolumeNumber('')
      setEdition('')
      setManualVolumes([])
      onFermer()
    },
  })

  function queueManualVolume() {
    const parsed = Number(volumeNumber.trim())
    if (!volumeNumber.trim() || !Number.isInteger(parsed) || parsed <= 0) return
    setManualVolumes((prev) => [...prev, { volumeNumber: parsed, edition: edition.trim() }])
    setVolumeNumber('')
  }

  function removeManualVolume(index: number) {
    setManualVolumes((prev) => prev.filter((_, i) => i !== index))
  }

  if (!ouvert) return null

  return (
    <section className="flex flex-col gap-3 rounded-xl bg-surface p-3">
      <h2 className="font-display text-sm font-semibold text-textPrimary">Ajouter un tome</h2>

      <div className="flex items-end gap-2">
        {/* min-w-0: without it, these columns keep min-width:auto and cannot
        go below the intrinsic width of their field (~175 px each).
        Two fields side by side then needed 510 px, and the screen overflowed
        horizontally on a phone. */}
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <label className="text-sm text-textDim" htmlFor="addVolumeNumber">
            Tome n°
          </label>
          <input
            id="addVolumeNumber"
            type="number"
            min={1}
            inputMode="numeric"
            value={volumeNumber}
            onChange={(e) => setVolumeNumber(e.target.value)}
            placeholder="ex: 12"
            className="champ"
          />
        </div>
        <div className="flex min-w-0 flex-[2] flex-col gap-1.5">
          <label className="text-sm text-textDim" htmlFor="addVolumeEdition">
            Édition
          </label>
          <input
            id="addVolumeEdition"
            value={edition}
            onChange={(e) => setEdition(e.target.value)}
            placeholder="ex: Kana, Black Édition..."
            className="champ"
            autoComplete="off"
          />
        </div>
        <button
          type="button"
          onClick={queueManualVolume}
          disabled={!volumeNumber.trim()}
          title="Ajouter ce tome à la liste sans valider tout de suite - pratique pour en enchaîner plusieurs (ex: T4 et T5 d'une même édition)"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface2 text-textPrimary disabled:opacity-50"
        >
          <Plus size={16} />
        </button>
      </div>

      {manualVolumes.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {manualVolumes.map((manual, index) => (
            <li
              key={`${manual.volumeNumber}-${manual.edition}-${index}`}
              className="flex items-center gap-1.5 rounded-full bg-surface2 px-3 py-1 text-xs text-textPrimary"
            >
              T. {manual.volumeNumber}
              {manual.edition && ` · ${manual.edition}`}
              <button
                type="button"
                onClick={() => removeManualVolume(index)}
                aria-label={`Retirer le tome ${manual.volumeNumber} de la liste`}
                className="text-textDim hover:text-textPrimary"
              >
                <X size={12} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {addMutation.isError && <ErrorBanner message={addMutation.error.message} />}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => addMutation.mutate()}
          disabled={totalVolumesToAdd === 0 || addMutation.isPending}
          className="btn-primaire"
        >
          {addMutation.isPending
            ? 'Ajout...'
            : totalVolumesToAdd > 1
              ? `Ajouter ${totalVolumesToAdd} tomes`
              : 'Ajouter'}
        </button>
        <button
          type="button"
          onClick={() => {
            onFermer()
            setVolumeNumber('')
            setEdition('')
                  setManualVolumes([])
          }}
          className="rounded-lg px-4 py-2 text-sm text-textDim"
        >
          Annuler
        </button>
      </div>
    </section>
  )
}
