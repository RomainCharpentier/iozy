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

    /**
     * Vrai si cette source catalogue les œuvres sous leur titre D'ORIGINE
     * (japonais/anglais/romaji pour un manga), comme Jikan/MyAnimeList - le
     * cas courant, d'où ce défaut.
     * <p>
     * Sert à une seule chose (voir FrenchTitleService.namesAnotherKnownWork) :
     * reconnaître qu'un titre français trouvé par le seul nom de l'auteur est
     * en fait le titre d'une AUTRE œuvre de cet auteur. Le raisonnement
     * repose entièrement sur le fait qu'une traduction française n'existe PAS
     * dans le catalogue interrogé - un fournisseur qui, lui, cherche
     * justement par titre français (voir GoogleBooksTitleSearchProvider)
     * ferait donc écarter les bonnes réponses, et doit répondre faux.
     */
    default boolean catalogsOriginalTitles() {
        return true;
    }
}
