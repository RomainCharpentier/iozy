package com.iozycore.listing;

/**
 * Ce que vaut vraiment le montant de livraison lu sur une annonce.
 * <p>
 * Sans cette distinction, « 2,83 € » et « à partir de 2,83 € » se ressemblent
 * dans un {@code BigDecimal} et se confondent à l'écran - alors que le premier
 * est un coût, et le second un plancher. Le total qui en découle n'est pas
 * « le coût réel » mais « le coût minimum estimé », et l'utilisateur doit
 * pouvoir le lire ainsi avant de décider.
 * <p>
 * La sémantique est conservée avec l'analyse enregistrée : une livraison notée
 * « à partir de » à l'instant de l'analyse ne doit jamais se relire plus tard
 * comme un tarif ferme.
 */
public enum ShippingEstimateKind {

    /** Livraison annoncée offerte : zéro, et c'est un vrai zéro. */
    FREE,

    /**
     * Un seul mode de livraison exposé : le montant est celui qui sera facturé,
     * pour autant qu'on puisse l'affirmer avant le paiement.
     */
    EXACT,

    /**
     * Plusieurs modes existent et la source affiche le moins cher. Le montant
     * est un <b>plancher</b> : le réel dépend du point relais choisi.
     */
    FROM,

    /** Rien de lisible - surtout ne pas supposer zéro, ce qui minorerait le coût. */
    UNKNOWN;

    /** Vrai quand le total qui en découle est un minimum, pas un montant ferme. */
    public boolean isLowerBound() {
        return this == FROM;
    }

    /** Vrai quand un montant exploitable existe (zéro compris). */
    public boolean hasAmount() {
        return this != UNKNOWN;
    }
}
