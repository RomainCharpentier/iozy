package com.iozycore.metadata;

import com.iozycore.domain.catalog.EntityType;

import java.util.List;
import java.util.Optional;

/**
 * Recherche best-effort d'un titre d'édition française pour un titre déjà
 * choisi (mangas) - ni Jikan ni MyAnimeList n'en connaissent (voir
 * JikanMetadataProvider/MyAnimeListMetadataProvider). Plusieurs fournisseurs
 * peuvent implémenter cette interface (voir MetadataSearchService.findFrenchTitle,
 * qui les essaie dans l'ordre et s'arrête au premier résultat) - même
 * principe que BarcodeMetadataProvider pour le scan ISBN.
 */
public interface FrenchTitleProvider {

    boolean supports(EntityType entityType);

    /**
     * @param query  titre à rechercher (romaji/anglais - jamais français par définition).
     * @param author mangaka, si connu - améliore nettement la précision de la
     *               recherche (voir OpenLibraryFrenchTitleProvider), peut être null/vide.
     * @param excludedTitleFragments fragments de titre (voir RelatedSeriesService)
     *               identifiant un spin-off/side-story/suite connu(e) du titre
     *               cherché - à écarter des résultats candidats (ex: "Dragon
     *               Ball Super nº 18" résolu à tort comme titre français de
     *               "Dragon Ball", sa suite étant beaucoup mieux référencée
     *               sur Open Library - vérifié manuellement, voir historique
     *               de la conversation).
     */
    Optional<String> findFrenchTitle(String query, String author, List<String> excludedTitleFragments);
}
