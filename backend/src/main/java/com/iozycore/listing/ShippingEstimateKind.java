package com.iozycore.listing;

/**
 * Ce que vaut vraiment le montant de livraison retenu pour une annonce.
 * <p>
 * Sans cette distinction, « 2,83 € » et « à partir de 2,83 € » se ressemblent
 * dans un {@code BigDecimal} et se confondent à l'écran - alors que le premier
 * est un coût, et le second un plancher. Le total qui en découle n'est pas
 * « le coût réel » mais « le coût minimum estimé », et l'utilisateur doit
 * pouvoir le lire ainsi avant de décider.
 *
 * <h2>Une seule dimension, délibérément</h2>
 * On pourrait séparer « combien » (montant), « quelle précision » (ferme,
 * plancher, estimation) et « d'où ça vient » (source, utilisateur). En pratique
 * la provenance ne fait que déterminer la précision - une saisie manuelle est
 * une estimation, un tarif lu sur une source unique est ferme - et une
 * deuxième dimension n'apporterait qu'une combinatoire vide à figer dans le
 * JSONB des analyses. Cette énumération dit donc <b>ce que le montant vaut</b>,
 * ce dont l'écran et le calcul ont réellement besoin.
 *
 * <h2>Figée avec l'analyse</h2>
 * La sémantique est conservée avec l'analyse enregistrée : une livraison notée
 * « à partir de » ou « estimée » à l'instant de l'analyse ne doit jamais se
 * relire plus tard comme un tarif ferme.
 */
public enum ShippingEstimateKind {

    /** Livraison annoncée offerte : zéro, et c'est un vrai zéro. */
    FREE,

    /**
     * Un seul mode de livraison exposé par la source : le montant est celui qui
     * sera facturé, pour autant qu'on puisse l'affirmer avant le paiement.
     * <b>Réservé aux cas où la source permet réellement cette affirmation</b> -
     * jamais attribué par défaut à un nombre qu'on a simplement reçu.
     */
    EXACT,

    /**
     * Plusieurs modes existent et la source affiche le moins cher. Le montant
     * est un <b>plancher</b> : le réel dépend du point relais choisi.
     */
    FROM,

    /**
     * Montant utilisable mais non garanti - typiquement saisi par
     * l'utilisateur. Il compte dans le coût d'acquisition (l'ignorer minorerait
     * l'achat), mais l'écran ne doit pas le présenter comme un tarif constaté,
     * et surtout jamais comme une livraison « non communiquée » : l'utilisateur
     * vient précisément de la communiquer.
     */
    ESTIMATED,

    /**
     * Aucun montant exploitable. Surtout ne pas supposer zéro : le coût qui en
     * découle est <b>incomplet</b>, et doit se lire comme tel. Un
     * {@code UNKNOWN} ne porte jamais de montant entrant dans un calcul.
     */
    UNKNOWN;

    /** Vrai quand le total qui en découle est un minimum, pas un montant ferme. */
    public boolean isLowerBound() {
        return this == FROM;
    }

    /** Vrai quand un montant exploitable existe (zéro compris) et entre donc dans le coût. */
    public boolean hasAmount() {
        return this != UNKNOWN;
    }

    /** Vrai quand le montant est utilisable sans être garanti : à dire, jamais à taire. */
    public boolean isEstimate() {
        return this == ESTIMATED;
    }
}
