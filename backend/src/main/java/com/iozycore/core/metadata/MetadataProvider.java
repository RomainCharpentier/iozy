package com.iozycore.core.metadata;

import com.iozycore.core.domain.catalog.EntityType;

import java.util.List;

/**
 * A MetadataProvider knows how to query one precise external source
 * (Jikan, BGG, IGDB later) and only answers for the EntityTypes
 * that it covers. MetadataSearchService routes the search to the competent
 * provider(s) without knowing their implementation details.
 */
public interface MetadataProvider {

    boolean supports(EntityType entityType);

    /** Must never throw an exception for a network outage: see MetadataSearchService. */
    List<MetadataCandidate> search(String query);

    /**
     * True if this source catalogs the works under their ORIGINAL title
     * (Japanese/English/romaji for a manga), like Jikan/MyAnimeList - the
     * common case, hence this default.
     * <p>
     * Used for one thing only (see FrenchTitleService.namesAnotherKnownWork):
     * recognizing that a French title found by the author name alone is
     * in fact the title of ANOTHER work by this author. The reasoning
     * relies entirely on the fact that a French translation does NOT exist
     * in the queried catalog - a provider that, on the contrary, searches
     * by French title (see GoogleBooksTitleSearchProvider)
     * would make the right answers get discarded, and must answer false.
     */
    default boolean catalogsOriginalTitles() {
        return true;
    }
}
