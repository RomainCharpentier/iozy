package com.iozycore.metadata.manga;

import com.iozycore.domain.catalog.EntityType;

import java.util.List;

/**
 * Renvoie les titres de séries clairement DISTINCTES (spin-off, side story...)
 * d'une série identifiée par son identifiant externe (ex: malId) - jamais une
 * réédition/adaptation de la même œuvre (voir implémentations : une
 * "alternative version"/"alternative setting" est volontairement exclue,
 * elle désigne souvent une vraie réédition qu'on veut au contraire garder
 * comme résultat de recherche de tomes).
 * <p>
 * Sert à écarter un spin-off publié sous un titre structurellement identique
 * à un vrai nom de collection (ex: "Blue Lock - Episode Nagi - Tome 5",
 * indiscernable de "Dragon Ball - Perfect Edition - Tome 5" sans cette
 * information externe - voir historique de la conversation, cas Tokyo
 * Ghoul:re/Blue Lock Episode Nagi/Demon Slayer School Days).
 */
public interface RelatedSeriesProvider {

    boolean supports(EntityType entityType);

    /** Best-effort : liste vide si l'identifiant est inconnu, si l'appel
     * échoue, ou si la série n'a aucune relation de ce type. */
    List<String> findRelatedSeriesTitles(String externalId);
}
