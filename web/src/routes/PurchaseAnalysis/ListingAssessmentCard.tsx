import { AlertTriangle, Info, Layers, Tag, ShieldQuestion } from 'lucide-react'
import type {
  AssessmentHeadline,
  ListingAssessmentDto,
  PricePosition,
  TrustLevel,
  TrustSignal,
} from '../../types/purchaseAnalysis'

/**
 * Le verdict personnalisé : trois dimensions gardées distinctes, puis la
 * synthèse qui domine.
 *
 * L'ordre d'affichage est celui de la décision. D'abord ce que le lot
 * **t'apporte** — un lot qui n'apporte rien n'est jamais une bonne affaire,
 * si peu cher soit-il. Ensuite le **prix**, qui ne tranche qu'une fois
 * l'intérêt établi. Enfin les **points à vérifier**, qui ne se mélangent
 * jamais aux deux premiers : un prix très bas est un bon prix ET un point de
 * vigilance, les deux à la fois, et les fondre ferait perdre l'un ou l'autre.
 *
 * Aucune note sur 100 nulle part : IozyCore ne mesure pas une probabilité de
 * fraude, il montre ce qu'il voit et nomme ce qu'il en déduit.
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

function euros(v: number | null): string {
  return v === null ? '—' : `${v.toFixed(2)} €`
}

export function ListingAssessmentCard({
  assessment,
  coutEstMinimum = false,
}: {
  assessment: ListingAssessmentDto
  /** Vrai quand la livraison n'est qu'un « à partir de » : les coûts par élément
   * héritent alors de cette réserve, et l'écran ne doit pas les donner pour fermes. */
  coutEstMinimum?: boolean
}) {
  const { collectionFit: fit, trust } = assessment
  const synthese = SYNTHESES[assessment.headline]
  const couleurSynthese =
    synthese.ton === 'bon' ? 'text-accentText' : synthese.ton === 'attention' ? 'text-warning' : 'text-textPrimary'

  return (
    <div className="flex flex-col gap-4 rounded-2xl bg-surface p-4">
      {/* Le verdict domine : un seul signal principal par carte. */}
      <h2 className={`font-display text-lg font-bold ${couleurSynthese}`}>{synthese.titre}</h2>

      {/* 1. Ce que ça t'apporte. La question qu'aucun comparateur ne sait poser. */}
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
                {/* Le chiffre qui décide vraiment : sans les doublons, le prix
                    affiché flatte l'affaire. */}
                {fit.pricePerUsefulItem !== null && (
                  <>
                    {' · '}
                    <span className="font-semibold text-textPrimary">
                      {euros(fit.pricePerUsefulItem)} / élément réellement utile
                    </span>
                  </>
                )}
              </p>
            )}
            {fit.interest === 'NOTHING_NEW' && (
              <p className="text-sm text-warning">Tu possèdes déjà tous les éléments identifiés.</p>
            )}
          </>
        )}
      </section>

      {/* 2. Le prix, séparément - et honnête sur ce qu'il ne sait pas. */}
      <section className="flex flex-col gap-1.5 border-t border-surface2 pt-3">
        <span className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-textDim uppercase">
          <Tag size={12} />
          Prix
        </span>
        <p className="text-sm font-semibold text-textPrimary">{PRIX[assessment.pricePosition]}</p>
        {/* Dire sur QUOI porte la comparaison : le prix de l'article, hors
            frais, comme les annonces auxquelles on le compare. */}
        <p className="text-xs text-textDim">Comparé sur le prix de l'annonce, hors frais.</p>
        {assessment.pricePosition === 'REFERENCE_UNAVAILABLE' ? (
          <p className="text-xs text-textDim">
            Pas assez de prix relevés pour situer cette offre. Relever des prix depuis le détail par série rendra les
            prochaines analyses plus sûres.
          </p>
        ) : (
          <p className="text-xs text-textDim">
            Référence {euros(assessment.referencePrice)}
            {assessment.deviationPercent !== null &&
              ` · ${assessment.deviationPercent > 0 ? '+' : ''}${assessment.deviationPercent} %`}
            {' · confiance '}
            {CONFIANCES[assessment.referenceConfidence] ?? assessment.referenceConfidence}
            {/* Dire d'où vient le chiffre, toujours : ce sont des prix relevés
                dans IozyCore, pas des transactions réelles. */}
            {' — construite à partir de tes prix relevés, pas de ventes conclues.'}
          </p>
        )}
      </section>

      {/* 3. Les points à vérifier - jamais fondus dans le prix. */}
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
            {/* Le dire explicitement : un prix très bas reste une bonne affaire
                du côté prix. Ce n'est pas une accusation. */}
            Un prix très bas appelle la prudence, mais reste une vraie occasion possible — les deux lectures
            coexistent.
          </p>
        )}
      </section>
    </div>
  )
}
