package com.iozycore.metadata;

import com.iozycore.domain.catalog.EntityType;

import java.util.List;

/**
 * Un MetadataProvider sait interroger une source externe précise
 * (Jikan, BGG, IGDB plus tard) et ne répond que pour les EntityType
 * qu'il couvre. MetadataSearchService route la recherche vers le(s)
 * provider(s) compétent(s) sans connaître leurs détails d'implémentation.
 */
public interface MetadataProvider {

    boolean supports(EntityType entityType);

    /** Ne doit jamais lever d'exception pour une panne réseau : voir MetadataSearchService. */
    List<MetadataCandidate> search(String query);
}
