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
 */
public record ListingAssessment(CollectionFit collectionFit, PricePosition pricePosition,
                                 BigDecimal referencePrice, ConfidenceLevel referenceConfidence,
                                 Integer deviationPercent, ListingTrustAssessment trust, Headline headline) {

    /**
     * Calcule la synthèse et la fige dans l'objet.
     * <p>
     * Composant réel plutôt que méthode dérivée : une analyse est persistée en
     * JSONB, et un accesseur calculé se sérialiserait sans pouvoir se relire
     * (piège déjà rencontré sur CollectionStatus). Le figer garantit en prime
     * qu'une analyse ancienne rendra toujours le verdict qu'elle a rendu ce
     * jour-là, même si la règle évolue ensuite - c'est bien un instantané.
     */
    public static ListingAssessment of(CollectionFit collectionFit, PricePosition pricePosition,
                                        BigDecimal referencePrice, ConfidenceLevel referenceConfidence,
                                        Integer deviationPercent, ListingTrustAssessment trust) {
        return new ListingAssessment(collectionFit, pricePosition, referencePrice, referenceConfidence,
                deviationPercent, trust, synthese(collectionFit, pricePosition, trust));
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
