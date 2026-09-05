package com.iozycore.metadata.manga;

/**
 * Un titre français trouvé par un {@link FrenchTitleProvider}, accompagné de
 * la façon dont il a été trouvé : deux résultats n'ont pas du tout la même
 * valeur de preuve, et
 * {@link FrenchTitleService#findFrenchTitle(com.iozycore.domain.catalog.EntityType, String, String, java.util.List, String)}
 * s'en sert pour arbitrer entre fournisseurs (une correspondance sur la
 * série cherchée l'emporte sur une simple trouvaille "du même auteur", quel
 * que soit l'ordre des fournisseurs) et pour décider s'il faut vérifier le
 * résultat avant de le retenir.
 */
public record FrenchTitleMatch(String title, Confidence confidence) {

    public enum Confidence {
        /**
         * La recherche qui a trouvé ce titre contenait les termes de la série
         * cherchée (titre complet, ou un mot distinctif de ce titre) : c'est
         * la requête elle-même qui rattache le résultat à la série demandée.
         */
        SERIES_MATCHED,
        /**
         * Dernier recours "auteur seul" : RIEN de la série cherchée n'a
         * matché, le résultat n'est qu'un livre français de cet auteur. Peut
         * être le bon titre traduit ("Forget Me Not" -&gt; "Fragments
         * d'elles"), mais tout aussi bien une AUTRE œuvre du même auteur
         * ("Vagabond" -&gt; "Slam Dunk") - à vérifier avant d'être retenu,
         * voir FrenchTitleService.namesAnotherKnownWork.
         */
        AUTHOR_ONLY
    }

    public static FrenchTitleMatch seriesMatched(String title) {
        return new FrenchTitleMatch(title, Confidence.SERIES_MATCHED);
    }

    public static FrenchTitleMatch authorOnly(String title) {
        return new FrenchTitleMatch(title, Confidence.AUTHOR_ONLY);
    }
}
