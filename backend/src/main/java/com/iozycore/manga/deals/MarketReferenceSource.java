package com.iozycore.manga.deals;

/**
 * D'où vient une référence marché. Toujours dit, jamais supposé.
 *
 * <h2>Une seule source produit une référence</h2>
 * Les prix relevés par l'utilisateur. Ni l'estimation IA ni le prix neuf
 * catalogue n'en constituent une : ce sont des repères utiles ailleurs (coût
 * pour compléter, négociation, verdict global), mais les présenter comme
 * « le marché » donnerait à une supposition l'autorité d'un constat. La
 * distinction existait déjà pour le prix par tome ({@link PriceBasis}) ; elle
 * s'applique désormais aussi au positionnement prix.
 */
public enum MarketReferenceSource {

    /** Prix relevés dans IozyCore, filtrés sur des annonces structurellement comparables. */
    OBSERVED_COMPARABLES,

    /** Aucune référence - voir {@link ReferenceGap} pour ce qui manque exactement. */
    NONE,

    /**
     * Analyse enregistrée avant que la provenance soit conservée. On ne
     * réinvente pas après coup d'où venait son chiffre : on dit qu'on l'ignore.
     */
    NOT_RECORDED
}
