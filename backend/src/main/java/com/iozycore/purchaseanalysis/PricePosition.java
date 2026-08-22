package com.iozycore.purchaseanalysis;

/**
 * Où se situe le prix demandé par rapport à une référence marché.
 *
 * Catégories nommées plutôt qu'un score : « très bon prix » se discute et
 * s'explique (« 35 % sous une référence tirée de 7 relevés »), « 82/100 » ne
 * se discute pas. C'est aussi ce qui permet de dire honnêtement
 * REFERENCE_UNAVAILABLE quand il n'y a rien de solide à comparer, au lieu de
 * produire un chiffre rassurant tiré de deux observations douteuses.
 *
 * Un prix TRÈS bas reste un très bon prix ici : la vigilance qu'il appelle est
 * une autre dimension (voir ListingTrustAssessment), et l'écraser sur celle-ci
 * ferait passer une vraie occasion pour un défaut.
 */
public enum PricePosition {
    VERY_GOOD_PRICE,
    GOOD_PRICE,
    FAIR_PRICE,
    RATHER_EXPENSIVE,
    TOO_EXPENSIVE,
    /** Aucune référence assez fiable : on ne juge pas. */
    REFERENCE_UNAVAILABLE
}
