import { AlertTriangle, Info, Layers, Tag, ShieldQuestion } from 'lucide-react'
import type {
  AssessmentHeadline,
  ListingAssessmentDto,
  PricePosition,
  ReferenceGap,
  ShippingEstimateKind,
  TrustLevel,
  TrustSignal,
} from '@/common/types/purchaseAnalysis'
import { CLASSE_CARTE } from '@/common/components/Carte'
import { formaterEuros } from '@/common/lib/formats'

/**
 * The personalised verdict: three dimensions kept distinct, then the
 * summary that dominates.
 *
 * The display order is the order of the decision. First what the batch
 * **brings you** — a batch that brings nothing is never a good deal,
 * however cheap it is. Then the **price**, which only decides once
 * the interest is established. Last the **points to check**, which never mix
 * with the first two: a very low price is a good price AND a point of
 * caution, both at once, and merging them would lose one or the other.
 *
 * No score out of 100 anywhere: IozyCore does not measure a probability of
 * fraud, it shows what it sees and names what it deduces from it.
 */

const SYNTHESES: Record<AssessmentHeadline, { titre: string; ton: 'bon' | 'neutre' | 'attention' }> = {
  GOOD_FOR_YOUR_COLLECTION: { titre: 'Bonne offre pour ta collection', ton: 'bon' },
  USEFUL_BUT_EXPENSIVE: { titre: 'Utile pour toi, mais cher', ton: 'attention' },
  USEFUL_PRICE_UNKNOWN: { titre: 'Utile pour toi — prix impossible à situer', ton: 'neutre' },
  LIMITED_INTEREST: { titre: 'Intérêt limité pour ta collection', ton: 'attention' },
  NOTHING_NEW_FOR_YOU: { titre: "Rien de neuf pour toi dans ce lot", ton: 'attention' },
  CHECK_BEFORE_BUYING: { titre: 'À vérifier avant tout achat', ton: 'attention' },
  CONTENT_TO_CONFIRM: { titre: 'Contenu du lot à confirmer', ton: 'neutre' },
}

const PRIX: Record<PricePosition, string> = {
  VERY_GOOD_PRICE: 'Très bon prix',
  GOOD_PRICE: 'Bon prix',
  FAIR_PRICE: 'Prix correct',
  RATHER_EXPENSIVE: 'Plutôt cher',
  TOO_EXPENSIVE: 'Trop cher',
  REFERENCE_UNAVAILABLE: 'Référence insuffisante',
}

const VIGILANCE: Record<TrustLevel, string> = {
  NO_OBVIOUS_SIGNAL: 'Aucun signal évident',
  A_FEW_THINGS_TO_CHECK: 'Quelques points à vérifier',
  EXAMINE_CAREFULLY: 'Annonce à examiner attentivement',
  CONCERNING: 'Signaux préoccupants',
}

const SIGNAUX: Record<TrustSignal, string> = {
  NO_PHOTO: "Aucune photo : impossible de juger l'état réel",
  VERY_FEW_PHOTOS: 'Très peu de photos pour un lot',
  SHORT_DESCRIPTION: 'Description très courte',
  OFF_PLATFORM_PAYMENT_MENTION: 'Le texte propose de payer ou discuter hors de la plateforme',
  PRICE_FAR_BELOW_REFERENCE: 'Prix nettement en dessous de la référence',
}

const CONFIANCES: Record<string, string> = { HIGH: 'bonne', MEDIUM: 'moyenne', LOW: 'faible' }

/**
 * What is missing, and so what to do.
 *
 * "Référence insuffisante" alone gives nothing to act on. Saying WHICH record to
 * add turns a silent screen into a useful one - and it is the only thing
 * that makes the severity of the filtering acceptable: we refuse to compare, but
 * we explain how to obtain a comparison.
 */
const MANQUES: Record<ReferenceGap, string | null> = {
  NONE: null,
  EDITION_NOT_IN_CATALOGUE:
    "Cette édition n'est pas encore renseignée : complète sa fiche, puis relève un prix pour la situer.",
  NO_OBSERVATION:
    'Aucun prix relevé sur cette édition. Relève le prix de deux ou trois annonces de taille comparable pour que la prochaine analyse tranche.',
  NO_COMPARABLE_SHAPE:
    "Des prix existent pour cette édition, mais aucun sur un lot comparable — un tome seul et une intégrale ne se valent pas au tome. Relève un prix sur un lot de taille voisine.",
  ONLY_STALE_OBSERVATIONS:
    'Les prix relevés sur des lots comparables ont plus de deux ans : ils décrivent un autre marché. Un relevé récent suffirait.',
  ONLY_CURRENT_LISTING:
    "Le seul prix comparable connu vient de cette annonce elle-même : elle ne peut pas servir de référence à sa propre évaluation. Il faut une autre offre du même type.",
  INCOMPLETE_LOT_COVERAGE:
    "Une des séries du lot n'a pas de référence. Additionner les autres donnerait un repère trop bas, donc un lot faussement « trop cher ».",
  NOT_RECORDED: "Analyse antérieure : la provenance de cette référence n'a pas été conservée.",
}

function euros(v: number | null): string {
  return v === null ? '—' : `${formaterEuros(v)}`
}

export function ListingAssessmentCard({
  assessment,
  shippingKind = 'UNKNOWN',
}: {
  assessment: ListingAssessmentDto
  /** What the retained delivery is worth. The costs per item are computed on the
   * acquisition cost: they therefore inherit its reservations - minimum when the
   * shipping is a "from", incomplete when no shipping is known. */
  shippingKind?: ShippingEstimateKind
}) {
  const { collectionFit: fit, trust } = assessment
  const coutEstMinimum = shippingKind === 'FROM'
  const livraisonInconnue = shippingKind === 'UNKNOWN'
  const synthese = SYNTHESES[assessment.headline]
  const couleurSynthese =
    synthese.ton === 'bon' ? 'text-accentText' : synthese.ton === 'attention' ? 'text-warning' : 'text-textPrimary'

  return (
    <div className={`flex flex-col gap-4 ${CLASSE_CARTE}`}>
      {/* The verdict dominates: a single main signal per card. */}
      <h2 className={`font-display text-lg font-bold ${couleurSynthese}`}>{synthese.titre}</h2>

      {/* 1. What it brings you. The question no comparison tool knows how to ask. */}
      <section className="flex flex-col gap-1.5">
        <span className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-textDim uppercase">
          <Layers size={12} />
          Intérêt pour ta collection
        </span>
        {fit.interest === 'UNKNOWN' ? (
          <p className="text-sm text-textDim">
            Aucun élément n'a pu être identifié — confirme le contenu du lot pour obtenir cette partie.
          </p>
        ) : (
          <>
            <p className="text-sm text-textPrimary">
              {fit.detectedItemCount} élément{fit.detectedItemCount > 1 ? 's' : ''} · {fit.missingItemCount} manquant
              {fit.missingItemCount > 1 ? 's' : ''}
              {fit.ownedItemCount > 0 && ` · ${fit.ownedItemCount} déjà possédé${fit.ownedItemCount > 1 ? 's' : ''}`}
              {fit.wishlistedItemCount > 0 && ` · ${fit.wishlistedItemCount} dans tes envies`}
            </p>
            {fit.pricePerItem !== null && (
              <p className="text-sm text-textDim">
                {coutEstMinimum && 'au moins '}
                {euros(fit.pricePerItem)} / élément
                {/* The figure that really decides: without the duplicates, the displayed
                    price flatters the deal. */}
                {/* With no duplicate, the two amounts are identical:
                    showing both teaches nothing and drowns the figure
                    that counts when there is one. */}
                {fit.pricePerUsefulItem !== null && fit.pricePerUsefulItem !== fit.pricePerItem && (
                  <>
                    {' · '}
                    <span className="font-semibold text-textPrimary">
                      {euros(fit.pricePerUsefulItem)} / élément réellement utile
                    </span>
                  </>
                )}
              </p>
            )}
            {/* These costs are computed on the acquisition cost: without known
                delivery, they are underestimated, and keeping quiet would make them wrong. */}
            {fit.pricePerItem !== null && livraisonInconnue && (
              <p className="text-xs text-textDim">Livraison non incluse : ces coûts sont sous-évalués.</p>
            )}
            {fit.interest === 'NOTHING_NEW' && (
              <p className="text-sm text-warning">Tu possèdes déjà tous les éléments identifiés.</p>
            )}
          </>
        )}
      </section>

      {/* 2. The price, separately - and honest about what it does not know. */}
      <section className="flex flex-col gap-1.5 border-t border-surface2 pt-3">
        <span className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-textDim uppercase">
          <Tag size={12} />
          Prix
        </span>
        <p className="text-sm font-semibold text-textPrimary">{PRIX[assessment.pricePosition]}</p>
        {/* Say WHAT the comparison covers: the price of the item, excluding
            fees, like the listings it is compared to. */}
        <p className="text-xs text-textDim">Comparé sur le prix de l'annonce, hors frais.</p>
        {assessment.pricePosition === 'REFERENCE_UNAVAILABLE' ? (
          <p className="text-xs text-textDim">
            {/* "Not enough" and "nothing at all" are not said the same way: comparables
                sometimes exist, in insufficient number to
                decide, and saying so avoids sending the user to look for
                data they have already entered. */}
            {assessment.referenceConfidence === 'LOW' && assessment.referenceSampleSize > 0
              ? `${assessment.referenceSampleSize} annonce${
                  assessment.referenceSampleSize > 1 ? 's' : ''
                } comparable${assessment.referenceSampleSize > 1 ? 's' : ''} observée${
                  assessment.referenceSampleSize > 1 ? 's' : ''
                }${
                  assessment.referenceSampleSize > 1 ? ', trop dispersées' : ''
                } — référence insuffisante pour juger le prix. Un ou deux relevés de plus suffiraient.`
              : (MANQUES[assessment.referenceGap] ??
                'Pas assez de prix relevés comparables pour situer cette offre.')}
            {/* "No data" and "data, but no comparable" are not said the
                same way: the second tells the user that their
                records exist and that it is their SHAPE that does not match -
                so what to record next. */}
            {assessment.referenceExaminedCount > 0 && assessment.referenceSampleSize === 0 && (
              <>
                {' '}
                {assessment.referenceExaminedCount} prix relevé
                {assessment.referenceExaminedCount > 1 ? 's' : ''} examiné
                {assessment.referenceExaminedCount > 1 ? 's' : ''} pour cette édition, aucun sur un lot comparable.
              </>
            )}
          </p>
        ) : assessment.referenceSource === 'OBSERVED_COMPARABLES' ? (
          <p className="text-xs text-textDim">
            Référence {euros(assessment.referencePrice)}
            {assessment.deviationPercent !== null &&
              ` · ${assessment.deviationPercent > 0 ? '+' : ''}${assessment.deviationPercent} %`}
            {' · confiance '}
            {CONFIANCES[assessment.referenceConfidence] ?? assessment.referenceConfidence}
            {/* The size of the sample decides what the median is worth:
                hiding it would make "good confidence" unverifiable. This number
                counts distinct LISTINGS, not records: the same offer
                followed several times is worth only one. */}
            {assessment.referenceSampleSize > 0 &&
              ` · ${assessment.referenceSampleSize} annonce${assessment.referenceSampleSize > 1 ? 's' : ''} comparable${
                assessment.referenceSampleSize > 1 ? 's' : ''
              }`}
            {/* What makes a reference DEBATABLE, and so correctable: how
                much the comparables agree, and how old the most
                recent one is. Without it, "good confidence" has to be taken on trust. */}
            {assessment.referenceSpreadPercent !== null &&
              ` · resserrés à ${assessment.referenceSpreadPercent} % près`}
            {assessment.referenceMostRecentObservation !== null &&
              ` · le plus récent le ${new Date(assessment.referenceMostRecentObservation).toLocaleDateString('fr-FR')}`}
            {/* Always say where the figure comes from: these are prices recorded
                in IozyCore, not real transactions. */}
            {' — tes prix relevés sur des lots de même forme et de taille voisine, pas des ventes conclues.'}
          </p>
        ) : (
          /* Analysis from before the current rules. Its figure often came from
             an estimate - sometimes a language model - that nothing
             then distinguished from an observed market. The saved verdict stays
             the one that was given that day: we do not rewrite the past. But
             we stop presenting this figure as a market reference, and
             above all giving it a "good confidence". */
          <p className="text-xs text-warning">
            Estimation utilisée lors de cette analyse : {euros(assessment.referencePrice)}
            {assessment.deviationPercent !== null &&
              ` · ${assessment.deviationPercent > 0 ? '+' : ''}${assessment.deviationPercent} %`}
            . Sa provenance n'était pas enregistrée à l'époque — ce n'est pas un prix de marché observé, et le
            verdict ci-dessus est celui qui avait été rendu alors.
          </p>
        )}
      </section>

      {/* 3. The points to check - never merged into the price. */}
      <section className="flex flex-col gap-1.5 border-t border-surface2 pt-3">
        <span className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-textDim uppercase">
          <ShieldQuestion size={12} />
          {VIGILANCE[trust.level]}
        </span>
        {trust.signals.length === 0 ? (
          <p className="text-xs text-textDim">Rien d'inhabituel dans ce que l'annonce montre.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {trust.signals.map((signal) => (
              <li key={signal} className="flex items-start gap-1.5 text-xs text-textDim">
                {signal === 'OFF_PLATFORM_PAYMENT_MENTION' || signal === 'NO_PHOTO' ? (
                  <AlertTriangle size={12} className="mt-0.5 shrink-0 text-warning" />
                ) : (
                  <Info size={12} className="mt-0.5 shrink-0" />
                )}
                <span>{SIGNAUX[signal]}</span>
              </li>
            ))}
          </ul>
        )}
        {trust.signals.includes('PRICE_FAR_BELOW_REFERENCE') && (
          <p className="text-xs text-textDim">
            {/* Say it explicitly: a very low price stays a good deal
                on the price side. It is not an accusation. */}
            Un prix très bas appelle la prudence, mais reste une vraie occasion possible — les deux lectures
            coexistent.
          </p>
        )}
      </section>
    </div>
  )
}
