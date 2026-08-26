import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { quickAdd } from '../../api/entities'
import { queryKeys } from '../../lib/queryKeys'
import { Chip } from '../../components/Chip'
import { ErrorBanner } from '../../components/ErrorBanner'
import { CONDITIONS, CONDITION_LABELS, type Condition } from '../../types/entityTypes'

interface ManualVolume {
  volumeNumber: number
  edition: string
}

/**
 * Parcours MANUEL (voir VolumeInteractionPanel/AddOwnershipForm pour le
 * parcours CONTEXTUEL, déclenché depuis un clic sur une tuile déjà visible -
 * les deux sont volontairement distincts, voir "deux modes d'ajout") : pour
 * un tome qui n'apparaît pas encore dans la grille (numéro/édition hors de
 * ce qui est déjà connu). Complète une édition déjà en collection avec un ou
 * plusieurs tomes manquants (ex: les tomes 4 et 5 d'une "Black Edition"
 * jamais retrouvés par la recherche automatique côté BnF/Google Books - trou
 * de données source, pas un bug, voir historique de la conversation sur
 * "Death Note").
 * <p>
 * `quickAdd` matche déjà une Entity existante par (entityTypeId, title) côté
 * backend (voir QuickAddService) - il suffit de réutiliser le titre exact de
 * la série déjà en collection, aucun nouvel endpoint nécessaire.
 * <p>
 * Même mécanique de file d'attente que QuickAddPage.tsx (voir
 * queueManualVolume) - permet d'enchaîner plusieurs tomes avant de valider
 * une seule fois, l'édition restant pré-remplie d'un tome au suivant. Reste
 * volontairement plus complet que AddOwnershipForm (numéro ET édition à
 * saisir, plusieurs tomes à la fois) : le parcours manuel n'a par définition
 * aucun contexte déjà connu à réutiliser.
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
  /** Absent depuis un aperçu : l'œuvre n'a pas encore de fiche, `quickAdd`
   *  la créera. Ne sert qu'à rafraîchir les caches de la fiche courante. */
  entityId?: string
  entityTypeId: string
  title: string
  /** Recopiés sur l'Entity créée. Indispensables depuis un aperçu : sans eux
   *  la fiche naîtrait sans jaquette ni auteur - même piège qu'au Lot 32. */
  attributes?: Record<string, unknown>
  /** Ouvert/fermé décidé par « Mes tomes » : la maquette v4 place le
   *  déclencheur « Ajouter un tome » dans l'en-tête de la section, pas sous la
   *  grille - le formulaire, lui, reste ici, sous les tuiles qu'il complète. */
  ouvert: boolean
  onFermer: () => void
  /** Appelé avec l'identifiant de la fiche après un ajout réussi - c'est ce
   *  qui permet à un aperçu de basculer vers la fiche qui vient de naître. */
  onAjoute?: (entityId: string) => void
}) {
  const queryClient = useQueryClient()
  const [condition, setCondition] = useState<Condition>('NEW')
  const [volumeNumber, setVolumeNumber] = useState('')
  const [edition, setEdition] = useState('')
  const [purchasePrice, setPurchasePrice] = useState('')
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

      const parsedPurchasePrice = purchasePrice.trim() ? Number(purchasePrice) : undefined

      let addedCount = 0
      let alreadyOwnedCount = 0
      let identifiant = entityId
      // Séquentiel : voir QuickAddPage.tsx pour la même précaution (l'Entity
      // existe déjà ici, mais un Variant à créer par appel reste plus sûr
      // qu'un Promise.all en cas d'erreur partielle).
      for (const item of items) {
        const result = await quickAdd({
          entityTypeId,
          title,
          condition,
          attributes,
          volumeNumber: item.volumeNumber,
          edition: item.edition || undefined,
          purchasePrice: parsedPurchasePrice,
        })
        identifiant = result.entityId
        if (result.matchedExistingVariant) alreadyOwnedCount++
        else addedCount++
      }
      return { addedCount, alreadyOwnedCount, entityId: identifiant }
    },
    onSuccess: (resultat) => {
      if (entityId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.ownerships(entityId) })
        queryClient.invalidateQueries({ queryKey: queryKeys.entities.detail(entityId) })
      }
      if (resultat.entityId) onAjoute?.(resultat.entityId)
      // Ajouté ici pour s'aligner sur AddOwnershipForm/OwnershipDetails, qui
      // invalident les trois : cette clé alimente Ma collection et les
      // panneaux de sélection des Tier Lists (voir listAllOwnerships).
      queryClient.invalidateQueries({ queryKey: queryKeys.allOwnerships })
      setVolumeNumber('')
      setEdition('')
      setPurchasePrice('')
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

      <div className="flex flex-col gap-1.5">
        <span className="text-sm text-textDim">État</span>
        <div className="flex gap-2">
          {CONDITIONS.map((c) => (
            <Chip key={c} label={CONDITION_LABELS[c]} isActive={condition === c} onClick={() => setCondition(c)} />
          ))}
        </div>
      </div>

      <div className="flex items-end gap-2">
        {/* min-w-0 : sans lui, ces colonnes gardent min-width:auto et ne peuvent
        pas descendre sous la largeur intrinsèque de leur champ (~175 px chacun).
        Deux champs côte à côte imposaient alors 510 px, et l'écran débordait
        horizontalement sur un téléphone. */}
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
            className="rounded-lg bg-surface2 px-3 py-2 text-sm text-textPrimary placeholder:text-textDim focus:outline-none focus:ring-2 focus:ring-accent/50"
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
            className="rounded-lg bg-surface2 px-3 py-2 text-sm text-textPrimary placeholder:text-textDim focus:outline-none focus:ring-2 focus:ring-accent/50"
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

      <div className="flex flex-col gap-1.5">
        <label className="text-sm text-textDim" htmlFor="addVolumePurchasePrice">
          Prix d'achat (optionnel)
        </label>
        <input
          id="addVolumePurchasePrice"
          type="number"
          min={0}
          step="0.01"
          inputMode="decimal"
          value={purchasePrice}
          onChange={(e) => setPurchasePrice(e.target.value)}
          placeholder="ex: 6.90"
          className="w-32 rounded-lg bg-surface2 px-3 py-2 text-sm text-textPrimary placeholder:text-textDim focus:outline-none focus:ring-2 focus:ring-accent/50"
        />
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
          className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accentInk disabled:opacity-50"
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
            setPurchasePrice('')
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
