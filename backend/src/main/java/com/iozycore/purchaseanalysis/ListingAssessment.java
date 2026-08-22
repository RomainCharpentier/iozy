package com.iozycore.purchaseanalysis;

import java.math.BigDecimal;

/**
 * Les trois questions d'une annonce, gardées distinctes, puis une synthèse.
 *
 * <h2>Pourquoi trois</h2>
 * « Ce lot m'apporte-t-il quelque chose ? », « ce prix est-il bon ? » et
 * « cette annonce est-elle nette ? » ne se répondent pas ensemble. Un lot
 * bradé mais entièrement en doublon est un mauvais achat à bon prix. Un lot
 * cher mais qui comble exactement les trous peut valoir la dépense. Un seul
 * chiffre écraserait ces cas l'un sur l'autre, et c'est précisément là que
 * l'utilisateur a besoin de voir clair.
 *
 * <h2>La synthèse ne remplace pas les dimensions</h2>
 * {@link #headline()} donne la phrase qui domine l'écran, mais les trois
 * dimensions restent lisibles à côté : c'est ce qui rend le verdict
 * explicable, et donc discutable.
 *
 * <h2>Indépendant de Vinted</h2>
 * Construit à partir de nombres et de texte, quelle que soit leur provenance.
 * Une annonce saisie entièrement à la main produit la même évaluation.
 *
 * <h2>Deux bases, jamais échangées</h2>
 * Le positionnement prix se calcule sur le <b>prix de l'annonce</b>, hors
 * frais, parce que les comparables le sont aussi. Ce que le lot apporte
 * ({@link CollectionFit}) se calcule sur le <b>coût d'acquisition</b>, frais
 * compris, parce que c'est ce qu'on paie. La fabrique ci-dessous est le seul
 * endroit où cette séparation se joue.
 *
 * @param referenceSampleSize comparables retenus derrière {@code referencePrice} - 0 quand il n'y en a pas
 * @param referenceSource     d'où vient la référence, ou {@code NOT_RECORDED} pour une analyse antérieure
 * @param referenceGap        ce qui manque quand il n'y a pas de référence, pour le dire utilement
 */
public record ListingAssessment(CollectionFit collectionFit, PricePosition pricePosition,
                                 BigDecimal referencePrice, MarketReferenceConfidence referenceConfidence,
                                 Integer deviationPercent, ListingTrustAssessment trust, Headline headline,
                                 int referenceSampleSize, MarketReferenceSource referenceSource,
                                 ReferenceGap referenceGap) {

    public ListingAssessment {
        // Analyses enregistrées avant que la provenance soit conservée : on dit
        // qu'on l'ignore plutôt que de leur inventer une source après coup.
        referenceConfidence = referenceConfidence == null ? MarketReferenceConfidence.UNAVAILABLE : referenceConfidence;
        referenceSource = referenceSource == null ? MarketReferenceSource.NOT_RECORDED : referenceSource;
        referenceGap = referenceGap == null ? ReferenceGap.NOT_RECORDED : referenceGap;
    }

    /**
     * Calcule le positionnement prix, la synthèse, et fige le tout.
     * <p>
     * Composants réels plutôt que méthodes dérivées : une analyse est persistée
     * en JSONB, et un accesseur calculé se sérialiserait sans pouvoir se relire
     * (piège déjà rencontré sur CollectionStatus). Le figer garantit en prime
     * qu'une analyse ancienne rendra toujours le verdict qu'elle a rendu ce
     * jour-là, même si la règle évolue ensuite - c'est bien un instantané.
     *
     * @param askingPrice le prix DE L'ANNONCE, hors frais. Jamais le coût
     *                    d'acquisition : les comparables étant hors frais, lui
     *                    passer le total renverserait le verdict.
     */
    public static ListingAssessment of(CollectionFit collectionFit, MarketReference reference,
                                        BigDecimal askingPrice, ListingTrustAssessment trust) {
        MarketReference ref = reference == null
                ? MarketReference.unavailable(ReferenceGap.NO_OBSERVATION, 0)
                : reference;
        // Une référence inexploitable ne sort pas d'ici : ni comme prix affiché,
        // ni comme écart en pourcentage. Un chiffre affiché est un chiffre auquel
        // on croit.
        BigDecimal prixReference = ref.isUsable() ? ref.price() : null;
        PricePosition position = DealAssessmentPolicy.positionOf(askingPrice, ref);
        return new ListingAssessment(collectionFit, position, prixReference, ref.confidence(),
                DealAssessmentPolicy.deviationPercent(askingPrice, prixReference), trust,
                synthese(collectionFit, position, trust),
                ref.sampleSize(), ref.source(), ref.gap());
    }

    /** La conclusion mise en avant. Elle nomme d'abord ce qui décide : l'apport, puis le prix. */
    public enum Headline {
        /** Rien de neuf pour cette collection - le prix ne rattrape pas ça. */
        NOTHING_NEW_FOR_YOU,
        /** Beaucoup de doublons : intérêt limité, quel que soit le prix. */
        LIMITED_INTEREST,
        /** Un apport réel et un prix qui tient. */
        GOOD_FOR_YOUR_COLLECTION,
        /** Un apport réel mais un prix trop élevé. */
        USEFUL_BUT_EXPENSIVE,
        /** Un apport réel, prix impossible à situer faute de référence. */
        USEFUL_PRICE_UNKNOWN,
        /** Des signaux forts : à vérifier avant toute chose. */
        CHECK_BEFORE_BUYING,
        /** Rien d'identifié : l'utilisateur doit d'abord confirmer le contenu. */
        CONTENT_TO_CONFIRM
    }

    /**
     * L'ordre compte, et il est délibéré.
     * <p>
     * Un signal de vigilance fort passe avant tout : inutile de discuter d'un
     * prix si l'annonce demande un virement hors plateforme. Vient ensuite
     * l'apport à la collection, parce qu'un lot qui n'apporte rien n'est jamais
     * une bonne affaire, si peu cher soit-il. Le prix ne tranche qu'en dernier,
     * une fois l'intérêt établi.
     */
    private static Headline synthese(CollectionFit collectionFit, PricePosition pricePosition,
                                      ListingTrustAssessment trust) {
        if (trust != null && trust.level() == TrustLevel.CONCERNING) {
            return Headline.CHECK_BEFORE_BUYING;
        }
        if (collectionFit == null || !collectionFit.isKnown()) {
            return Headline.CONTENT_TO_CONFIRM;
        }
        return switch (collectionFit.interest()) {
            case NOTHING_NEW -> Headline.NOTHING_NEW_FOR_YOU;
            case MOSTLY_DUPLICATES -> Headline.LIMITED_INTEREST;
            case UNKNOWN -> Headline.CONTENT_TO_CONFIRM;
            case PARTIALLY_USEFUL, HIGHLY_USEFUL -> switch (pricePosition) {
                case TOO_EXPENSIVE, RATHER_EXPENSIVE -> Headline.USEFUL_BUT_EXPENSIVE;
                case REFERENCE_UNAVAILABLE -> Headline.USEFUL_PRICE_UNKNOWN;
                default -> Headline.GOOD_FOR_YOUR_COLLECTION;
            };
        };
    }

    /**
     * Vrai quand la référence marché est trop faible pour recommander un montant
     * précis. Proposer « offre 53 € » sur deux observations douteuses donnerait
     * à un chiffre inventé l'autorité d'un calcul.
     */
    @com.fasterxml.jackson.annotation.JsonIgnore
    public boolean referenceTooWeakForAnOffer() {
        return pricePosition == PricePosition.REFERENCE_UNAVAILABLE;
    }
}
