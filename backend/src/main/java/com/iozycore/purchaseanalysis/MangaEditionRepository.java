package com.iozycore.purchaseanalysis;

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
}
