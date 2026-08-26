import { AlertTriangle, Info, Layers, Tag, ShieldQuestion } from 'lucide-react'
import type {
  AssessmentHeadline,
  ListingAssessmentDto,
  PricePosition,
  ReferenceGap,
  ShippingEstimateKind,
  TrustLevel,
  TrustSignal,
} from '../../types/purchaseAnalysis'
import { CLASSE_CARTE } from '../../components/Carte'

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

/**
 * Ce qui manque, et donc quoi faire.
 *
 * « Référence insuffisante » tout court laisse sans prise. Dire QUEL relevé
 * ajouter transforme un écran muet en écran utile - et c'est la seule chose
 * qui rende la sévérité du filtrage acceptable : on refuse de comparer, mais
 * on explique comment obtenir une comparaison.
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
  return v === null ? '—' : `${v.toFixed(2)} €`
}

export function ListingAssessmentCard({
  assessment,
  shippingKind = 'UNKNOWN',
}: {
  assessment: ListingAssessmentDto
  /** Ce que vaut la livraison retenue. Les coûts par élément se calculent sur le
   * coût d'acquisition : ils héritent donc de ses réserves - minimum quand le
   * port est un « à partir de », incomplet quand aucun port n'est connu. */
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
                {/* Sans aucun doublon, les deux montants sont identiques :
                    les afficher tous les deux n'apprend rien et noie le chiffre
                    qui compte quand il y en a un. */}
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
            {/* Ces coûts se calculent sur le coût d'acquisition : sans livraison
                connue, ils sont sous-évalués, et le taire les rendrait faux. */}
            {fit.pricePerItem !== null && livraisonInconnue && (
              <p className="text-xs text-textDim">Livraison non incluse : ces coûts sont sous-évalués.</p>
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
            {/* « Pas assez » et « rien du tout » ne se disent pas pareil : des
                comparables existent parfois, en nombre insuffisant pour
                trancher, et le dire évite de renvoyer l'utilisateur chercher
                une donnée qu'il a déjà saisie. */}
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
          </p>
        ) : assessment.referenceSource === 'OBSERVED_COMPARABLES' ? (
          <p className="text-xs text-textDim">
            Référence {euros(assessment.referencePrice)}
            {assessment.deviationPercent !== null &&
              ` · ${assessment.deviationPercent > 0 ? '+' : ''}${assessment.deviationPercent} %`}
            {' · confiance '}
            {CONFIANCES[assessment.referenceConfidence] ?? assessment.referenceConfidence}
            {/* La taille de l'échantillon décide de ce que vaut la médiane :
                la cacher rendrait « confiance bonne » invérifiable. Ce nombre
                compte des ANNONCES distinctes, pas des relevés : une même offre
                suivie plusieurs fois n'en vaut qu'une. */}
            {assessment.referenceSampleSize > 0 &&
              ` · ${assessment.referenceSampleSize} annonce${assessment.referenceSampleSize > 1 ? 's' : ''} comparable${
                assessment.referenceSampleSize > 1 ? 's' : ''
              }`}
            {/* Dire d'où vient le chiffre, toujours : ce sont des prix relevés
                dans IozyCore, pas des transactions réelles. */}
            {' — tes prix relevés sur des lots de même forme et de taille voisine, pas des ventes conclues.'}
          </p>
        ) : (
          /* Analyse antérieure aux règles actuelles. Son chiffre venait souvent
             d'une estimation - parfois d'un modèle de langage - que rien ne
             distinguait alors d'un marché observé. Le verdict enregistré reste
             celui qui a été rendu ce jour-là : on ne réécrit pas le passé. Mais
             on cesse de présenter ce chiffre comme une référence de marché, et
             surtout de lui attribuer une « confiance bonne ». */
          <p className="text-xs text-warning">
            Estimation utilisée lors de cette analyse : {euros(assessment.referencePrice)}
            {assessment.deviationPercent !== null &&
              ` · ${assessment.deviationPercent > 0 ? '+' : ''}${assessment.deviationPercent} %`}
            . Sa provenance n'était pas enregistrée à l'époque — ce n'est pas un prix de marché observé, et le
            verdict ci-dessus est celui qui avait été rendu alors.
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
