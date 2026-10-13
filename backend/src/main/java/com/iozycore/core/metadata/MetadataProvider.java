package com.iozycore.core.metadata;

import com.iozycore.core.domain.catalog.EntityType;

import java.util.List;
import java.util.Map;

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
     * The same search, for a caller that must tell "nothing found" from "no
     * answer" (Discover, for instance): an outage throws instead of returning
     * an empty list.
     *
     * <p>The default trusts {@link #search}: a provider that does not override
     * it counts as having answered. Override it in any provider that a caller
     * relies on for this distinction.
     *
     * @throws SourceUnavailableException when the source did not answer
     * @throws QuotaExceededException     when the source refused for quota
     */
    default List<MetadataCandidate> searchOrThrow(String query) {
        return search(query);
    }

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

    /**
     * What only a second call to this source knows about ONE work it already
     * identified: the cover, the number of players, the designers. Some
     * sources (BGG) give almost nothing at search time, and asking for the
     * details of every result would cost one call per result and per keystroke.
     * This is asked once, for the work being added or opened.
     *
     * <p>The source finds its own id in {@code attributes} ("bggId" for BGG).
     * The keys returned are attribute keys, the cover under
     * {@code coverImageUrl}. The default has nothing more to say: the search
     * result is already complete.
     *
     * @return the details, empty when the id is not there or the source has no more
     * @throws SourceUnavailableException when the source did not answer
     */
    default Map<String, Object> details(Map<String, Object> attributes) {
        return Map.of();
    }
}
