package com.iozycore.purchaseanalysis;

/**
 * Ce qui manque pour qu'une référence marché existe.
 *
 * <h2>Dire quoi faire, pas seulement qu'on ne sait pas</h2>
 * « Référence insuffisante » laisse l'utilisateur sans prise. « 3 prix relevés
 * sur cette édition, mais aucun sur un lot de taille comparable » lui dit
 * exactement quel relevé ajouter pour que la prochaine analyse tranche. C'est
 * la différence entre un écran honnête et un écran muet.
 */
public enum ReferenceGap {

    /** Rien ne manque : la référence existe. */
    NONE,

    /** L'édition n'est pas encore au catalogue - aucun relevé ne peut s'y rattacher. */
    EDITION_NOT_IN_CATALOGUE,

    /** Aucun prix relevé sur cette édition. */
    NO_OBSERVATION,

    /**
     * Des relevés existent, mais aucun ne porte sur un produit comparable -
     * tome seul contre lot, ou lots de tailles trop éloignées. Le cas le plus
     * important : c'est précisément celui où l'ancienne moyenne inventait un
     * prix.
     */
    NO_COMPARABLE_SHAPE,

    /** Des comparables existaient, mais tous trop anciens pour décrire le marché d'aujourd'hui. */
    ONLY_STALE_OBSERVATIONS,

    /** Lot multi-séries dont au moins une série n'a pas de référence : la somme serait tronquée, donc trompeuse. */
    INCOMPLETE_LOT_COVERAGE,

    /** Analyse antérieure à l'enregistrement de cette information. */
    NOT_RECORDED
}
