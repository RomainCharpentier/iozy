import { useMutation, useQueryClient } from '@tanstack/react-query'
import { markSold } from '../../api/ownerships'
import { queryKeys } from '../../lib/queryKeys'
import { CONDITION_LABELS, OWNERSHIP_STATUS_LABELS, type Condition } from '../../types/entityTypes'
import type { OwnershipResponse, VariantDto } from '../../types/api'

/** Trie les Ownership par numéro de tome (Manga) quand l'info est disponible,
 * pour afficher "Tome 1, Tome 2, Tome 3..." dans l'ordre plutôt que dans
 * l'ordre d'ajout (souvent différent : un tome manquant est fréquemment
 * complété plus tard). Les Ownership sans tome (jeu vidéo, jeu de société,
 * ou manga ajouté sans préciser de tome) restent dans leur ordre d'origine,
 * après celles qui en ont un.
 */
function sortByVolumeNumber(ownerships: OwnershipResponse[], variantsById: Map<string, VariantDto>) {
  return [...ownerships].sort((a, b) => {
    const volumeA = a.variantId ? variantsById.get(a.variantId)?.attributes.volumeNumber : undefined
    const volumeB = b.variantId ? variantsById.get(b.variantId)?.attributes.volumeNumber : undefined
    if (typeof volumeA === 'number' && typeof volumeB === 'number') return volumeA - volumeB
    if (typeof volumeA === 'number') return -1
    if (typeof volumeB === 'number') return 1
    return 0
  })
}

export function OwnershipsSection({
  entityId,
  ownerships,
  variants,
}: {
  entityId: string
  ownerships: OwnershipResponse[]
  variants: VariantDto[]
}) {
  const queryClient = useQueryClient()
  const sellMutation = useMutation({
    mutationFn: markSold,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.ownerships(entityId) }),
  })

  if (ownerships.length === 0) return null

  const variantsById = new Map(variants.map((v) => [v.id, v]))
  const sortedOwnerships = sortByVolumeNumber(ownerships, variantsById)

  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-display text-lg font-semibold text-textPrimary">Possessions</h2>
      <ul className="flex flex-col gap-2">
        {sortedOwnerships.map((ownership) => {
          const variant = ownership.variantId ? variantsById.get(ownership.variantId) : undefined
          return (
            <li key={ownership.id} className="flex items-center justify-between rounded-xl bg-surface p-3">
              <div className="text-sm">
                {/* Le libellé du tome (ex: "Tome 3 — Kana") prime sur l'état/statut
                    quand il est connu - c'est l'info qui distingue vraiment cette
                    ligne des autres Ownership de la même fiche. */}
                {variant && <p className="font-medium text-textPrimary">{variant.label}</p>}
                <p className="text-textPrimary">
                  {OWNERSHIP_STATUS_LABELS[ownership.status] ?? ownership.status} ·{' '}
                  {CONDITION_LABELS[ownership.condition as Condition] ?? ownership.condition}
                </p>
                <p className="text-textDim">Acquis le {ownership.acquiredAt}</p>
                {ownership.note && <p className="text-textDim">{ownership.note}</p>}
              </div>
              {ownership.status === 'OWNED' && (
                <button
                  type="button"
                  onClick={() => sellMutation.mutate(ownership.id)}
                  disabled={sellMutation.isPending}
                  className="shrink-0 rounded-lg bg-surface2 px-3 py-1.5 text-xs font-medium text-textPrimary disabled:opacity-50"
                >
                  Marquer vendu
                </button>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
