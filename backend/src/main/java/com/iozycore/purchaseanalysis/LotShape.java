package com.iozycore.purchaseanalysis;

/**
 * La <b>forme</b> d'un lot : ce qu'il est structurellement, avant tout prix.
 *
 * <h2>Pourquoi cette notion existe</h2>
 * Un tome seul, un lot partiel et une intégrale ne sont pas le même produit,
 * même série et même édition. Le marché de l'occasion les valorise
 * différemment <b>au tome</b> : un tome dépareillé se vend proche du neuf,
 * une intégrale se brade parce qu'elle demande un acheteur unique et un gros
 * colis. Ramener les trois à un « prix au tome » puis en prendre la médiane
 * produit un chiffre précis et faux.
 *
 * <h2>Ce qu'elle ne prétend pas être</h2>
 * Ce n'est pas une taxonomie du manga, c'est le minimum qui empêche de
 * comparer deux produits différents : combien de tomes, et est-ce que ça
 * couvre l'édition entière.
 */
public enum LotShape {

    /** Un seul tome. Le prix au tome y est le plus élevé du marché. */
    SINGLE_VOLUME,

    /** Plusieurs tomes sans couvrir l'édition. La taille compte encore, d'où la bande de tolérance du sélecteur. */
    PARTIAL_LOT,

    /** Tous les tomes de l'édition. Un produit à part, avec sa propre décote. */
    COMPLETE_SET,

    /**
     * Impossible à situer - typiquement un relevé « sur l'édition entière »
     * alors que le nombre de tomes de cette édition n'est pas renseigné. On ne
     * devine pas : un tel relevé est écarté des comparables.
     */
    INDETERMINATE;

    /**
     * @param volumeCount          nombre de tomes concernés, {@code 0} ou moins si on l'ignore
     * @param editionTotalVolumes  nombre total de tomes de l'édition, {@code null} si non renseigné -
     *                             sans lui, on ne peut pas distinguer une intégrale d'un lot partiel,
     *                             et le lot est traité comme partiel plutôt que promu intégrale
     */
    public static LotShape of(int volumeCount, Integer editionTotalVolumes) {
        if (volumeCount <= 0) {
            return INDETERMINATE;
        }
        if (volumeCount == 1) {
            return SINGLE_VOLUME;
        }
        if (editionTotalVolumes != null && editionTotalVolumes > 0 && volumeCount >= editionTotalVolumes) {
            return COMPLETE_SET;
        }
        return PARTIAL_LOT;
    }

    /** Vrai quand la forme permet de chercher des comparables. */
    public boolean isComparable() {
        return this != INDETERMINATE;
    }
}
