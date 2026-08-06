import { useMutation, useQueryClient } from '@tanstack/react-query'
import { markSold } from '../../api/ownerships'
import { queryKeys } from '../../lib/queryKeys'
import { CONDITION_LABELS, OWNERSHIP_STATUS_LABELS, type Condition } from '../../types/entityTypes'
import type { OwnershipResponse } from '../../types/api'

export function OwnershipsSection({ entityId, ownerships }: { entityId: string; ownerships: OwnershipResponse[] }) {
  const queryClient = useQueryClient()
  const sellMutation = useMutation({
    mutationFn: markSold,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.ownerships(entityId) }),
  })

  if (ownerships.length === 0) return null

  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-display text-lg font-semibold text-textPrimary">Possessions</h2>
      <ul className="flex flex-col gap-2">
        {ownerships.map((ownership) => (
          <li key={ownership.id} className="flex items-center justify-between rounded-xl bg-surface p-3">
            <div className="text-sm">
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
        ))}
      </ul>
    </section>
  )
}
