import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { TriangleAlert, Sparkles } from 'lucide-react'
import { getCompleteness } from '../../api/purchaseAnalysis'
import { createEditionUpgradeWish, deleteEditionUpgradeWish, listEditionUpgradeWishesForEntity } from '../../api/editionUpgrade'
import { queryKeys } from '../../lib/queryKeys'
import { groupVariantsByEdition, hasMixedEditions, type EditionGroup } from '../../lib/editionGroups'
import type { VariantDto } from '../../types/api'
import type { EditionUpgradeWishDto } from '../../types/editionUpgrade'

/** "17/26 tomes · 9 manquants · ~62,10 € pour compléter (théorique)" - une
 * ligne par édition détectée parmi les tomes possédés (voir
 * groupVariantsByEdition). Réutilise le même moteur de complétude que
 * l'Analyse d'achat (GET /purchase-analysis/completeness), jamais un calcul
 * dupliqué côté client. Porte aussi le toggle "je possède déjà cette
 * édition, mais je recherche mieux" (voir EditionUpgradeWish côté backend) -
 * n'a de sens que pour une édition nommée, jamais pour le groupe "".
 */
function EditionCompletenessRow({
  entityTitle,
  group,
  wish,
  onAddWish,
  onRemoveWish,
  isSavingWish,
}: {
  entityTitle: string
  group: EditionGroup
  wish: EditionUpgradeWishDto | undefined
  onAddWish: (desiredEditionName: string, note: string) => void
  onRemoveWish: () => void
  isSavingWish: boolean
}) {
  const owned = group.volumeNumbers.length
  const label = group.edition || 'Édition non précisée'
  const known = group.edition !== ''
  const [showUpgradeForm, setShowUpgradeForm] = useState(false)
  const [desiredEditionName, setDesiredEditionName] = useState('')
  const [note, setNote] = useState('')

  const completenessQuery = useQuery({
    queryKey: queryKeys.purchaseAnalysis.completeness(entityTitle, group.edition, group.volumeNumbers),
    queryFn: () => getCompleteness(entityTitle, group.edition, group.volumeNumbers),
    enabled: known,
  })

  return (
    <div className="rounded-xl bg-surface p-3">
      <p className="text-sm font-medium text-textPrimary">{label}</p>
      {!known && <p className="text-xs text-textDim">{owned} tome{owned > 1 ? 's' : ''}</p>}
      {known && completenessQuery.isLoading && <p className="text-xs text-textDim">Vérification...</p>}
      {known && completenessQuery.data && completenessQuery.data.totalVolumes === null && (
        <p className="text-xs text-textDim">{owned} tome{owned > 1 ? 's' : ''} · Total inconnu</p>
      )}
      {known && completenessQuery.data && completenessQuery.data.totalVolumes !== null && (
        <p className="text-xs text-textDim">
          {owned}/{completenessQuery.data.totalVolumes} tomes
          {completenessQuery.data.missingCount! > 0 && (
            <>
              {' '}
              · {completenessQuery.data.missingCount} manquant{completenessQuery.data.missingCount! > 1 ? 's' : ''}
              {completenessQuery.data.estimatedCostToComplete !== null && (
                <>
                  {' '}
                  · ~{completenessQuery.data.estimatedCostToComplete.toFixed(2)} € pour compléter
                  {completenessQuery.data.costToCompleteBasis === 'THEORETICAL_ONLY' ? ' (théorique)' : ' (marché)'}
                </>
              )}
            </>
          )}
        </p>
      )}

      {known && (
        <div className="mt-2">
          {wish ? (
            <div className="flex items-center justify-between gap-2 rounded-lg bg-violet/10 px-2.5 py-1.5 text-xs text-violet">
              <span className="flex items-center gap-1.5">
                <Sparkles size={13} className="shrink-0" />
                Envie d'amélioration{wish.desiredEditionName && ` : ${wish.desiredEditionName}`}
              </span>
              <button
                type="button"
                onClick={onRemoveWish}
                disabled={isSavingWish}
                className="shrink-0 font-medium underline disabled:opacity-50"
              >
                Retirer
              </button>
            </div>
          ) : showUpgradeForm ? (
            <div className="flex flex-col gap-1.5">
              <input
                value={desiredEditionName}
                onChange={(e) => setDesiredEditionName(e.target.value)}
                placeholder="Édition visée (ex : Perfect Edition) - optionnel"
                autoFocus
                className="rounded-lg bg-surface2 px-2.5 py-1.5 text-xs text-textPrimary placeholder:text-textDim focus:outline-none focus:ring-2 focus:ring-accent/50"
              />
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Note - optionnel"
                className="rounded-lg bg-surface2 px-2.5 py-1.5 text-xs text-textPrimary placeholder:text-textDim focus:outline-none focus:ring-2 focus:ring-accent/50"
              />
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    onAddWish(desiredEditionName.trim(), note.trim())
                    setShowUpgradeForm(false)
                    setDesiredEditionName('')
                    setNote('')
                  }}
                  disabled={isSavingWish}
                  className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-accentText disabled:opacity-50"
                >
                  Enregistrer
                </button>
                <button
                  type="button"
                  onClick={() => setShowUpgradeForm(false)}
                  className="rounded-lg px-2 py-1.5 text-xs text-textDim"
                >
                  Annuler
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowUpgradeForm(true)}
              className="text-xs font-medium text-violet underline"
            >
              Je recherche une meilleure édition
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export function SeriesCompletenessSection({
  entityId,
  entityTitle,
  variants,
}: {
  entityId: string
  entityTitle: string
  variants: VariantDto[]
}) {
  const queryClient = useQueryClient()
  const groups = groupVariantsByEdition(variants)

  const wishesQuery = useQuery({
    queryKey: queryKeys.editionUpgradeWishes.byEntity(entityId),
    queryFn: () => listEditionUpgradeWishesForEntity(entityId),
    enabled: groups.length > 0,
  })

  const createWishMutation = useMutation({
    mutationFn: createEditionUpgradeWish,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.editionUpgradeWishes.byEntity(entityId) }),
  })
  const deleteWishMutation = useMutation({
    mutationFn: deleteEditionUpgradeWish,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.editionUpgradeWishes.byEntity(entityId) }),
  })

  if (groups.length === 0) return null

  const mixed = hasMixedEditions(groups)

  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-display text-lg font-semibold text-textPrimary">Éditions</h2>
      {mixed && (
        <div className="flex items-start gap-2 rounded-xl bg-warning/10 px-4 py-3 text-sm text-warning">
          <TriangleAlert size={16} className="mt-0.5 shrink-0" />
          <span>
            Éditions mélangées : {groups.filter((g) => g.edition !== '').map((g) => `${g.edition} (${g.volumeNumbers.length})`).join(', ')}
          </span>
        </div>
      )}
      {groups.map((group) => {
        const wish = wishesQuery.data?.find((w) => w.currentEditionName === group.edition)
        return (
          <EditionCompletenessRow
            key={group.edition || '(sans édition)'}
            entityTitle={entityTitle}
            group={group}
            wish={wish}
            isSavingWish={createWishMutation.isPending || deleteWishMutation.isPending}
            onAddWish={(desiredEditionName, note) =>
              createWishMutation.mutate({
                entityId,
                currentEditionName: group.edition,
                desiredEditionName: desiredEditionName || undefined,
                note: note || undefined,
              })
            }
            onRemoveWish={() => wish && deleteWishMutation.mutate(wish.id)}
          />
        )
      })}
    </section>
  )
}
