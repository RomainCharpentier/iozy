package com.iozycore.domain.catalog;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** Port for {@link MangaEdition} persistence - lookups are case-insensitive at the query level (same convention as EntityRepository.findByTypeAndTitle), seriesTitle/editionName are stored as typed for display. */
public interface MangaEditionRepository {

    MangaEdition save(MangaEdition edition);

    Optional<MangaEdition> findById(UUID id);

    /** Case-insensitive on both fields. */
    Optional<MangaEdition> findBySeriesAndEdition(String seriesTitle, String editionName);

    /** All known editions of a series (case-insensitive) - powers "a Perfect edition exists for this work" warnings. */
    List<MangaEdition> findBySeriesTitle(String seriesTitle);

    /** All known editions structurally linked to a catalog Série (see {@link MangaEdition#entityId()}) - unlike
     * {@link #findBySeriesTitle}, never a text-matching fallback: only editions actually rattachées. */
    List<MangaEdition> findByEntityId(UUID entityId);
}
