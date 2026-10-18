package com.iozycore.manga.metadata;

import com.iozycore.core.domain.catalog.EntityType;

import java.util.List;

/**
 * Searches the real volumes (with cover) of the different French
 * editions of a series - see {@link VolumeCandidate}. Distinct from
 * {@link FrenchTitleProvider} (which only returns a title): here we want
 * enough to build a visual selection of owned volumes.
 */
public interface VolumeSearchProvider {

    boolean supports(EntityType entityType);

    /** Best-effort, "quick" coverage (see GoogleBooksVolumeSearchProvider.
     * QUICK_EDITION_KEYWORDS - most mangas have only one
     * French edition, no need to pay for an exhaustive search by
     * default): an empty list means "nothing found", never an error -
     * the caller then keeps the manual volume entry path.
     *
     * @param excludedTitleFragments title fragments (see RelatedSeriesService)
     *                               identifying a known spin-off/side-story of
     *                               the searched series - to exclude from the results,
     *                               never empty without reason but tolerated (no
     *                               filter applied in this case). */
    List<VolumeCandidate> searchVolumes(String seriesTitle, String author, List<String> excludedTitleFragments);

    /** Optional deep search (rarer edition keywords,
     * see DEEP_EDITION_KEYWORDS) - triggered only by an
     * explicit action of the user ("Chercher plus d'éditions"), never
     * automatically. Result meant to be MERGED with the one already
     * known from {@link #searchVolumes}, not to replace it (see
     * TomeSearchService.searchAdditionalEditions). Empty by default: a
     * provider that has no notion of deep search (no particular
     * edition to search further) simply stays silent here. */
    default List<VolumeCandidate> searchAdditionalEditions(String seriesTitle, String author, List<String> excludedTitleFragments) {
        return List.of();
    }

    /**
     * Find ONE precise volume, by its number (Batch 125) - "does volume 7 of
     * this series exist at your side?". Used to fill the gaps of a
     * list that the title searches left incomplete, without
     * starting a whole search again. Empty by default: only Google Books
     * can do it usefully (see GoogleBooksVolumeSearchProvider.probeVolume).
     */
    default List<VolumeCandidate> probeVolume(String seriesTitle, String author, int volumeNumber,
                                              List<String> excludedTitleFragments) {
        return List.of();
    }

    /**
     * The volumes of ONE named edition - "Hokage", "Édition originale" - by
     * searching the series WITH the name of the edition (batch 144). A search by
     * series only returns one page, where the plain edition takes all the room;
     * searching an edition by its name returns its own. Empty by default: only
     * Google Books can do it usefully, the BnF having already said everything in one
     * paginated request.
     *
     * @throws QuotaExceededException / SourceUnavailableException like a
     *         probe: the caller keeps what it has, and freezes nothing
     */
    default List<VolumeCandidate> searchEdition(String seriesTitle, String author, String editionName,
                                                List<String> excludedTitleFragments) {
        return List.of();
    }
}
