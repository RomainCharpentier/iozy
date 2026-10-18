import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2 } from 'lucide-react'
import {
  deleteMarketObservation,
  listMarketObservations,
  recordMarketObservation,
} from '@/common/api/purchaseAnalysis'
import { queryKeys } from '@/common/lib/queryKeys'
import { useToast } from '@/common/lib/toast'
import { ErrorBanner } from '@/common/components/ErrorBanner'
// Labels already defined for the purchase analysis - redefining them here would make
// two vocabularies that describe the same thing drift apart.
import { CONDITION_LABELS, LISTING_PLATFORM_LABELS } from '@/common/types/purchaseAnalysis'
import type { Condition, ListingPlatform, MarketPriceObservationDto } from '@/common/types/purchaseAnalysis'
import { formaterEuros } from '@/common/lib/formats'

const CHAMP =
  'min-h-11 rounded-lg bg-surface2 px-2.5 text-xs text-textPrimary placeholder:text-textDim focus:outline-none focus:ring-2 focus:ring-accent/50'

function observationLabel(observation: MarketPriceObservationDto): string {
  const portee = observation.scope
    ? `Tomes ${observation.scope.from}-${observation.scope.to}`
    : "L'édition entière"
  const etat = observation.observedCondition ? CONDITION_LABELS[observation.observedCondition] : null
  return [portee, provenance(observation), etat].filter(Boolean).join(' · ')
}

/**
 * Where this price comes from, in one word.
 *
 * A manual record says "Manuel"; a record from an analysed listing says
 * the marketplace, which is the useful information - "Vinted" places the price,
 * "from an analysis" places nothing. The list stays a list of prices, not
 * a technical history.
 */
function provenance(observation: MarketPriceObservationDto): string {
  return observation.origin === 'MANUAL_ENTRY'
    ? 'Manuel'
    : LISTING_PLATFORM_LABELS[observation.platform]
}

/**
 * The recorded prices of an edition, and a way to remove a wrong one.
 *
 * A record feeds all the later purchase analyses of this edition -
 * it is the only source of prices actually observed. Yet it was
 * invisible once saved (no screen listed them) and
 * final: a misplaced comma skewed the verdicts for good, with no
 * way to remove it (docs/USER_JOURNEYS.md, §14).
 *
 * **No edit is offered**, on purpose: a record is a
 * fact observed on a date, not a field to adjust. Fixing it afterwards
 * would rewrite a past observation; we remove the wrong one and save the
 * right one.
 *
 * <h2>Record one from here (2026-08-29)</h2>
 * Until now, the ONLY way to save an observed price was to analyse a
 * listing, then open the detail of a series in its result, and only
 * if the edition was recognised and the volumes were contiguous (§16 of the journeys). Yet these
 * records are the only source of prices actually observed, and the
 * quality of all later analyses depends on them: the most decisive capability
 * of the app was the most hidden.
 *
 * <p>This screen already listed them, and allowed removing a wrong one. It
 * lacked the opposite action - and above all, when the edition had no record,
 * this block was not shown at all: nothing said that these prices existed.
 */
export function EditionObservations({ editionId, editionName }: { editionId: string; editionName: string }) {
  const queryClient = useQueryClient()
  const toast = useToast()
  const [formulaireOuvert, setFormulaireOuvert] = useState(false)
  const query = useQuery({
    queryKey: queryKeys.purchaseAnalysis.marketObservations(editionId),
    queryFn: () => listMarketObservations(editionId),
  })

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: queryKeys.purchaseAnalysis.marketObservations(editionId) })
    // An edition can only be deleted when no record is attached to it
    // anymore (see PurchaseAnalysisService.deleteEdition): the list of
    // editions must therefore be read again too.
    queryClient.invalidateQueries({ queryKey: queryKeys.purchaseAnalysis.allEditions })
  }

  const deleteMutation = useMutation({
    mutationFn: (observation: MarketPriceObservationDto) => deleteMarketObservation(observation.id),
    onSuccess: (_result, observation) => {
      invalidate()
      toast('Prix relevé supprimé', {
        label: 'Annuler',
        // Real restore: everything that defines a record is saved again
        // as it was (edition, range, price, platform, condition, date, note).
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

  // The same listing followed over time produces several records. Lined up
  // without distinction, they read as several sellers - and that is
  // exactly the illusion that grouping by listing avoids in the calculation.
  // The screen must say the same thing as the engine.
  const relevesParAnnonce = new Map<string, number>()
  for (const observation of observations) {
    if (observation.listingIdentity) {
      relevesParAnnonce.set(
        observation.listingIdentity,
        (relevesParAnnonce.get(observation.listingIdentity) ?? 0) + 1,
      )
    }
  }
  const suitUneAnnonceDejaRelevee = (observation: MarketPriceObservationDto) =>
    observation.listingIdentity !== null && (relevesParAnnonce.get(observation.listingIdentity) ?? 0) > 1

  return (
    <div className="flex flex-col gap-1 border-t border-surface2 pt-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[11px] font-semibold tracking-wide text-textDim uppercase">
          Prix relevés ({observations.length})
        </span>
        {!formulaireOuvert && (
          <button
            type="button"
            onClick={() => setFormulaireOuvert(true)}
            className="flex min-h-11 items-center gap-1.5 text-xs font-semibold text-accentText"
          >
            <Plus size={13} />
            Relever un prix
          </button>
        )}
      </div>

      {formulaireOuvert && (
        <FormulaireDeRelevé
          editionId={editionId}
          onEnregistré={() => {
            invalidate()
            setFormulaireOuvert(false)
          }}
          onAnnuler={() => setFormulaireOuvert(false)}
        />
      )}

      {observations.length === 0 && !formulaireOuvert && (
        <span className="text-[11px] text-textDim">Aucun prix relevé pour cette édition.</span>
      )}
      {/* Says where the list gets filled, once, rather than a notification
          after each analysis - the action is already done, reminding it each
          time would be noise. */}
      {observations.some((observation) => observation.origin === 'LISTING_ANALYSIS') && (
        <span className="text-[11px] text-textDim">
          Les annonces que tu analyses viennent s'ajouter ici, à leur prix affiché hors frais.
          {relevesParAnnonce.size > 0 &&
            Array.from(relevesParAnnonce.values()).some((n) => n > 1) &&
            ' Les relevés d’une même annonce suivie dans le temps comptent pour une seule offre.'}
        </span>
      )}
      <ul className="flex flex-col gap-0.5">
        {observations.map((observation) => (
          <li key={observation.id} className="flex items-center gap-2 text-xs">
            <span className="min-w-0 flex-1 truncate text-textDim">
              <span className="font-semibold text-textPrimary">{formaterEuros(observation.observedPrice)}</span>
              {' · '}
              {observationLabel(observation)}
              {' · '}
              {new Date(observation.observedAt).toLocaleDateString('fr-FR')}
              {suitUneAnnonceDejaRelevee(observation) && (
                <span className="text-textDim"> · même annonce</span>
              )}
            </span>
            <button
              type="button"
              onClick={() => deleteMutation.mutate(observation)}
              disabled={deleteMutation.isPending}
              aria-label={`Supprimer le prix relevé de ${formaterEuros(observation.observedPrice)} pour ${editionName}`}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-textDim hover:bg-dangerTint hover:text-dangerText disabled:opacity-50"
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


/**
 * Enter an observed price, by hand.
 *
 * <h2>What the form asks, and what it does not ask</h2>
 * The price and the platform, because a price without its origin places nothing -
 * "45 €" does not mean the same thing on Vinted and at a bookshop. The
 * date is pre-filled with today: a record is a DATED fact, and
 * the vast majority are entered the day they were seen.
 *
 * <p>The <b>range</b> stays optional, and that is a choice: without it, the
 * record describes the whole edition (see {@code observationLabel}), which is
 * exactly what we observe when seeing a complete batch. Filling it in lets
 * the engine deduce a price per volume (see MarketPriceCalculator) - so we
 * offer it without requiring it.
 *
 * <p>The condition too: many listings do not state it, and inventing
 * "Good condition" by default would skew comparisons in the optimistic direction.
 */
function FormulaireDeRelevé({
  editionId,
  onEnregistré,
  onAnnuler,
}: {
  editionId: string
  onEnregistré: () => void
  onAnnuler: () => void
}) {
  const [prix, setPrix] = useState('')
  const [plateforme, setPlateforme] = useState<ListingPlatform>('VINTED')
  const [etat, setEtat] = useState<Condition | ''>('')
  const [du, setDu] = useState('')
  const [au, setAu] = useState('')
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))

  const enregistrement = useMutation({
    mutationFn: () =>
      recordMarketObservation({
        mangaEditionId: editionId,
        // Both bounds or none: a half-entered range describes
        // nothing, and the server would silently ignore it.
        volumeRangeStart: du && au ? Number(du) : undefined,
        volumeRangeEnd: du && au ? Number(au) : undefined,
        observedPrice: Number(prix),
        platform: plateforme,
        observedCondition: etat || undefined,
        observedAt: date,
      }),
    onSuccess: onEnregistré,
  })

  function envoyer(evenement: FormEvent) {
    evenement.preventDefault()
    enregistrement.mutate()
  }

  return (
    <form onSubmit={envoyer} className="flex flex-col gap-2 rounded-lg bg-surface2/60 p-2.5">
      <div className="flex flex-wrap gap-2">
        <label className="flex flex-col gap-1 text-[11px] text-textDim">
          Prix constaté (€)
          <input
            type="number"
            min={0}
            step="0.01"
            required
            value={prix}
            onChange={(e) => setPrix(e.target.value)}
            placeholder="ex: 45"
            className={`${CHAMP} w-28`}
          />
        </label>
        <label className="flex flex-col gap-1 text-[11px] text-textDim">
          Où
          <select
            value={plateforme}
            onChange={(e) => setPlateforme(e.target.value as ListingPlatform)}
            className={`${CHAMP} w-32`}
          >
            {Object.entries(LISTING_PLATFORM_LABELS).map(([valeur, libelle]) => (
              <option key={valeur} value={valeur}>
                {libelle}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-[11px] text-textDim">
          Le
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={`${CHAMP} w-36`} />
        </label>
      </div>

      <div className="flex flex-wrap gap-2">
        <label className="flex flex-col gap-1 text-[11px] text-textDim">
          Tomes (facultatif)
          <span className="flex items-center gap-1.5">
            <input
              type="number"
              min={1}
              value={du}
              onChange={(e) => setDu(e.target.value)}
              aria-label="Premier tome du lot"
              placeholder="du"
              className={`${CHAMP} w-16`}
            />
            <input
              type="number"
              min={1}
              value={au}
              onChange={(e) => setAu(e.target.value)}
              aria-label="Dernier tome du lot"
              placeholder="au"
              className={`${CHAMP} w-16`}
            />
          </span>
        </label>
        <label className="flex flex-col gap-1 text-[11px] text-textDim">
          État (facultatif)
          <select
            value={etat}
            onChange={(e) => setEtat(e.target.value as Condition | '')}
            className={`${CHAMP} w-40`}
          >
            <option value="">Non précisé</option>
            {Object.entries(CONDITION_LABELS).map(([valeur, libelle]) => (
              <option key={valeur} value={valeur}>
                {libelle}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Without a range, the record describes the whole edition - said here rather than
          discovered afterwards in the list. */}
      <span className="text-[11px] text-textDim">
        {du && au ? `Ce prix décrira les tomes ${du} à ${au}.` : "Sans tomes précisés, ce prix décrira l'édition entière."}
      </span>

      {enregistrement.isError && <ErrorBanner message={enregistrement.error.message} />}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={enregistrement.isPending}
          className="btn-primaire"
        >
          {enregistrement.isPending ? 'Enregistrement...' : 'Enregistrer'}
        </button>
        <button type="button" onClick={onAnnuler} className="min-h-11 rounded-lg px-3 text-xs text-textDim">
          Annuler
        </button>
      </div>
    </form>
  )
}
