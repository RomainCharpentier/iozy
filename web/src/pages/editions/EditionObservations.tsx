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
// Libellés déjà définis pour l'analyse d'achat - les redéfinir ici ferait
// diverger deux vocabulaires qui décrivent la même chose.
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
 * D'où vient ce prix, en un mot.
 *
 * Un relevé manuel dit « Manuel » ; un relevé issu d'une annonce analysée dit
 * la place de marché, qui est l'information utile - « Vinted » situe le prix,
 * « issu d'une analyse » ne situe rien. La liste reste une liste de prix, pas
 * un historique technique.
 */
function provenance(observation: MarketPriceObservationDto): string {
  return observation.origin === 'MANUAL_ENTRY'
    ? 'Manuel'
    : LISTING_PLATFORM_LABELS[observation.platform]
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
 *
 * <h2>En relever un, depuis ici (2026-08-29)</h2>
 * Jusqu'ici, la SEULE façon d'enregistrer un prix observé était d'analyser une
 * annonce, puis d'ouvrir le détail d'une série de son résultat, et seulement
 * si l'édition était reconnue et les tomes contigus (§16 des parcours). Or ces
 * relevés sont la seule source de prix réellement constatés, dont dépend la
 * qualité de toutes les analyses suivantes : la capacité la plus déterminante
 * de l'application était la plus cachée.
 *
 * <p>Cet écran les listait déjà, et permettait d'en retirer un faux. Il
 * manquait le geste inverse - et surtout, quand l'édition n'avait aucun relevé,
 * ce bloc ne s'affichait pas du tout : rien ne disait que ces prix existaient.
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

  // Une même annonce suivie dans le temps produit plusieurs relevés. Alignés
  // sans distinction, ils se lisent comme plusieurs vendeurs - et c'est
  // exactement l'illusion que le regroupement par annonce évite côté calcul.
  // L'écran doit dire la même chose que le moteur.
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
      {/* Dit d'où la liste se remplit, une fois, plutôt qu'une notification
          après chaque analyse - le geste est déjà fait, le rappeler à chaque
          fois serait du bruit. */}
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
 * Saisir un prix constaté, à la main.
 *
 * <h2>Ce que le formulaire demande, et ce qu'il ne demande pas</h2>
 * Le prix et la plateforme, parce qu'un prix sans sa provenance ne situe rien -
 * « 45 € » ne veut pas dire la même chose sur Vinted et chez un libraire. La
 * date est pré-remplie à aujourd'hui : un relevé est un fait DATÉ, et
 * l'immense majorité se saisit le jour où on l'a vu.
 *
 * <p>La <b>portée</b> reste facultative, et c'est un choix : sans elle, le
 * relevé décrit l'édition entière (voir {@code observationLabel}), ce qui est
 * exactement ce qu'on constate en voyant un lot complet. La renseigner permet
 * au moteur d'en déduire un prix au tome (voir MarketPriceCalculator) - donc on
 * la propose sans l'exiger.
 *
 * <p>L'état aussi : beaucoup d'annonces ne le disent pas, et inventer
 * « Bon état » par défaut fausserait les comparaisons dans le sens optimiste.
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
        // Les deux bornes ou aucune : une portée à moitié saisie ne décrit
        // rien, et le serveur l'ignorerait silencieusement.
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

      {/* Sans portée, le relevé décrit l'édition entière - dit ici plutôt que
          découvert après coup dans la liste. */}
      <span className="text-[11px] text-textDim">
        {du && au ? `Ce prix décrira les tomes ${du} à ${au}.` : "Sans tomes précisés, ce prix décrira l'édition entière."}
      </span>

      {enregistrement.isError && <ErrorBanner message={enregistrement.error.message} />}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={enregistrement.isPending}
          className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-accentInk disabled:opacity-50"
        >
          {enregistrement.isPending ? 'Enregistrement...' : 'Enregistrer'}
        </button>
        <button type="button" onClick={onAnnuler} className="rounded-lg px-3 py-1.5 text-xs text-textDim">
          Annuler
        </button>
      </div>
    </form>
  )
}
