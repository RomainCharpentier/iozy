package com.iozycore.manga.deals;

/**
 * Un point à vérifier avant d'acheter — <b>jamais un verdict de fraude</b>.
 * <p>
 * La distinction n'est pas cosmétique. IozyCore ne voit d'une annonce que son
 * texte, son prix et ses photos : rien là-dedans ne permet d'établir une
 * intention. Un prix très bas peut être une vraie occasion, une description
 * courte peut venir d'un vendeur pressé. Ces signaux servent donc à diriger le
 * regard, pas à conclure - et surtout, ils n'entrent pas dans l'évaluation du
 * prix, qui reste une question séparée.
 * <p>
 * Codes structurés plutôt que phrases : le français vit côté présentation, ce
 * qui permet de tester les règles sans dépendre d'un libellé.
 */
public enum TrustSignal {

    /** Aucune photo : impossible de juger l'état réel de ce qui est vendu. */
    NO_PHOTO(TrustSignalSeverity.HIGH),

    /** Une ou deux photos seulement pour un lot : on ne voit pas tout ce qu'on achète. */
    VERY_FEW_PHOTOS(TrustSignalSeverity.MEDIUM),

    /** Description absente ou réduite à quelques mots. */
    SHORT_DESCRIPTION(TrustSignalSeverity.LOW),

    /**
     * Le texte propose de payer ou de discuter hors de la plateforme. C'est le
     * seul signal réellement fort ici : sortir de la plateforme, c'est perdre
     * la protection acheteur, et c'est le mode opératoire classique de l'arnaque.
     */
    OFF_PLATFORM_PAYMENT_MENTION(TrustSignalSeverity.HIGH),

    /**
     * Prix très inférieur à la référence. <b>Signal de vigilance, pas preuve de
     * fraude</b> : une excellente affaire existe réellement. Il figure ici pour
     * appeler la prudence, et ne dégrade jamais l'évaluation du prix - qui, elle,
     * en fait au contraire un bon point.
     */
    PRICE_FAR_BELOW_REFERENCE(TrustSignalSeverity.MEDIUM);

    private final TrustSignalSeverity severity;

    TrustSignal(TrustSignalSeverity severity) {
        this.severity = severity;
    }

    public TrustSignalSeverity severity() {
        return severity;
    }
}
