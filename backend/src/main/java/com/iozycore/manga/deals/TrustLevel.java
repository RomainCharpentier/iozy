package com.iozycore.manga.deals;

/**
 * Ce qu'on peut honnêtement dire de la vigilance à avoir sur une annonce.
 * <p>
 * Quatre paliers nommés, et surtout <b>pas de note sur 100</b>. Un
 * « confiance : 94/100 » suggérerait une probabilité mesurée ; or IozyCore ne
 * dispose ni de l'historique du vendeur, ni des transactions, ni d'aucune base
 * de signalements. Ce qu'il voit, c'est un texte, un prix et des photos. Mettre
 * un chiffre là-dessus habillerait une intuition en mesure.
 */
public enum TrustLevel {

    /** Rien d'inhabituel dans ce que l'annonce montre. */
    NO_OBVIOUS_SIGNAL,

    /** Quelques détails à regarder, sans gravité particulière. */
    A_FEW_THINGS_TO_CHECK,

    /** Assez d'éléments pour prendre le temps de vérifier avant d'acheter. */
    EXAMINE_CAREFULLY,

    /** Un signal fort au moins : à ne pas traiter à la légère. */
    CONCERNING
}
