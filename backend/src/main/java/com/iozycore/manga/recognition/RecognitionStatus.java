package com.iozycore.manga.recognition;

/**
 * L'issue d'une analyse de photos. Nommée plutôt que réduite à un booléen :
 * « rien reconnu » et « moteur en panne » appellent des phrases différentes à
 * l'écran, et une seule des deux vaut la peine d'être réessayée.
 *
 * <p>Aucune de ces issues n'est une erreur d'API : la route rend 200 dans tous
 * les cas, comme {@code POST /listing-metadata/resolve}. Un bandeau rouge
 * confondrait « ces photos ne montrent pas de tomes lisibles » avec « le
 * service est cassé ».
 */
public enum RecognitionStatus {

    /** Tout ce qui était visible a été identifié. */
    OK,

    /** Une partie identifiée, une partie non - le cas le plus fréquent sur un lot. */
    PARTIAL,

    /** Le moteur a répondu, mais n'a rien su lire sur ces photos. */
    NOTHING_RECOGNIZED,

    /** Aucune photo exploitable : hôte non autorisé, format refusé, trop lourde, illisible. */
    NO_USABLE_IMAGE,

    /** Aucun moteur configuré - IozyCore marche sans, la saisie manuelle reste entière. */
    NO_ENGINE,

    /**
     * Le service a atteint son quota - sur le palier gratuit, un compte de jetons
     * par jour, qu'une photo d'étagère consomme vite. Réessayer dans la minute
     * ne donnera rien : c'est demain, ou le Catalogue à la main. Distingué de
     * UNAVAILABLE parce que l'écran doit dire l'un et pas l'autre.
     */
    QUOTA_EXCEEDED,

    /** Le moteur a échoué : panne, délai dépassé. Réessayer plus tard a du sens. */
    UNAVAILABLE;

    /** Vrai si réessayer peut donner autre chose - sert à décider d'afficher « Réessayer ». */
    public boolean worthRetrying() {
        return this == UNAVAILABLE;
    }
}
