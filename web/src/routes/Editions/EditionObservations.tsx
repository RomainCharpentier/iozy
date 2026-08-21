import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Trash2 } from 'lucide-react'
import {
  deleteMarketObservation,
  listMarketObservations,
  recordMarketObservation,
} from '../../api/purchaseAnalysis'
import { queryKeys } from '../../lib/queryKeys'
import { useToast } from '../../components/Toast'
import { ErrorBanner } from '../../components/ErrorBanner'
// Libellés déjà définis pour l'analyse d'achat - les redéfinir ici ferait
// diverger deux vocabulaires qui décrivent la même chose.
import { CONDITION_LABELS, LISTING_PLATFORM_LABELS } from '../../types/purchaseAnalysis'
import type { MarketPriceObservationDto } from '../../types/purchaseAnalysis'

function observationLabel(observation: MarketPriceObservationDto): string {
  const portee = observation.scope
    ? `Tomes ${observation.scope.from}-${observation.scope.to}`
    : "L'édition entière"
  const etat = observation.observedCondition ? CONDITION_LABELS[observation.observedCondition] : null
  return [portee, LISTING_PLATFORM_LABELS[observation.platform], etat]
    .filter(Boolean)
    .join(' · ')
}

/**
 * Les prix relevés d'une édition, et de quoi en retirer un faux.
 *
 * Un relevé alimente toutes les analyses d'achat suivantes de cette édition -
 * c'est la seule source de prix réellement observés. Il était pourtant
 * jusqu'ici invisible une fois enregistré (aucun écran ne les listait) et
 * définitif : une virgule mal placée faussait durablement les verdicts, sans
 * moyen de la retirer (docs/USER_JOURNEYS.md, §14).
 *
 * **Aucune modification n'est offerte**, volontairement : un relevé est un
 * fait constaté à une date, pas un champ qu'on ajuste. Le corriger après coup
 * réécrirait une observation passée ; on retire le faux et on enregistre le
 * juste.
 */
export function EditionObservations({ editionId, editionName }: { editionId: string; editionName: string }) {
  const queryClient = useQueryClient()
  const toast = useToast()
  const query = useQuery({
    queryKey: queryKeys.purchaseAnalysis.marketObservations(editionId),
    queryFn: () => listMarketObservations(editionId),
  })

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: queryKeys.purchaseAnalysis.marketObservations(editionId) })
    // Une édition ne devient supprimable que lorsque plus aucun relevé n'y est
    // rattaché (voir PurchaseAnalysisService.deleteEdition) : la liste des
    // éditions doit donc être relue elle aussi.
    queryClient.invalidateQueries({ queryKey: queryKeys.purchaseAnalysis.allEditions })
  }

  const deleteMutation = useMutation({
    mutationFn: (observation: MarketPriceObservationDto) => deleteMarketObservation(observation.id),
    onSuccess: (_result, observation) => {
      invalidate()
      toast('Prix relevé supprimé', {
        label: 'Annuler',
        // Restauration réelle : tout ce qui définit un relevé est réenregistré
        // à l'identique (édition, portée, prix, plateforme, état, date, note).
        onAction: async () => {
          await recordMarketObservation({
            mangaEditionId: observation.mangaEditionId,
            volumeRangeStart: observation.scope?.from,
            volumeRangeEnd: observation.scope?.to,
            observedPrice: observation.observedPrice,
            platform: observation.platform,
            observedCondition: observation.observedCondition ?? undefined,
            observedAt: observation.observedAt,
            note: observation.note ?? undefined,
          })
          invalidate()
        },
      })
    },
  })

  const observations = query.data ?? []
  if (observations.length === 0) return null

  return (
    <div className="flex flex-col gap-1 border-t border-surface2 pt-2">
      <span className="text-[11px] font-semibold tracking-wide text-textDim uppercase">
        Prix relevés ({observations.length})
      </span>
      <ul className="flex flex-col gap-0.5">
        {observations.map((observation) => (
          <li key={observation.id} className="flex items-center gap-2 text-xs">
            <span className="min-w-0 flex-1 truncate text-textDim">
              <span className="font-semibold text-textPrimary">{observation.observedPrice.toFixed(2)} €</span>
              {' · '}
              {observationLabel(observation)}
              {' · '}
              {new Date(observation.observedAt).toLocaleDateString('fr-FR')}
            </span>
            <button
              type="button"
              onClick={() => deleteMutation.mutate(observation)}
              disabled={deleteMutation.isPending}
              aria-label={`Supprimer le prix relevé de ${observation.observedPrice.toFixed(2)} € pour ${editionName}`}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-textDim hover:bg-dangerTint hover:text-dangerText disabled:opacity-50"
            >
              <Trash2 size={13} />
            </button>
          </li>
        ))}
      </ul>
      {deleteMutation.isError && <ErrorBanner message={deleteMutation.error.message} />}
    </div>
  )
}
