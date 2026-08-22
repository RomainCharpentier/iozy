package com.iozycore.purchaseanalysis;

/**
 * Ce que vaut une référence marché, <b>l'absence comprise</b>.
 *
 * <h2>Pourquoi un quatrième niveau</h2>
 * {@link ConfidenceLevel} n'a que HIGH/MEDIUM/LOW : l'absence de référence s'y
 * disait par un prix {@code null} qu'il fallait penser à tester ailleurs. En
 * nommant {@link #UNAVAILABLE}, la référence porte elle-même l'information, et
 * un appelant qui l'oublie ne peut plus produire un positionnement à partir de
 * rien.
 *
 * <h2>Le seuil qui compte</h2>
 * Seuls HIGH et MEDIUM autorisent un positionnement prix. LOW dit « on a
 * quelque chose, mais pas de quoi trancher » : l'écran l'affiche comme
 * insuffisant plutôt que de tirer une catégorie d'une donnée qu'on sait
 * fragile.
 */
public enum MarketReferenceConfidence {

    /** Plusieurs comparables récents, proches entre eux. */
    HIGH,

    /** De quoi se situer, avec une réserve : peu de comparables, ou une approximation assumée. */
    MEDIUM,

    /** Trop peu, trop dispersé ou trop ancien pour trancher. Ne sert pas à positionner un prix. */
    LOW,

    /** Aucun comparable retenu. Il n'y a pas de référence, et l'écran doit le dire. */
    UNAVAILABLE;

    /** Vrai quand la référence peut servir à situer un prix. Le seul test à faire avant de comparer. */
    public boolean allowsPositioning() {
        return this == HIGH || this == MEDIUM;
    }

    /** Descend d'un cran, sans jamais tomber sous LOW : une référence existante ne devient pas inexistante. */
    public MarketReferenceConfidence degraded() {
        return switch (this) {
            case HIGH -> MEDIUM;
            case MEDIUM, LOW -> LOW;
            case UNAVAILABLE -> UNAVAILABLE;
        };
    }

    /** Plafonne à un niveau donné - sert aux approximations assumées (lot multi-séries, édition mal renseignée). */
    public MarketReferenceConfidence cappedAt(MarketReferenceConfidence plafond) {
        return compareTo(plafond) < 0 ? plafond : this;
    }
}
