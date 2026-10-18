package com.iozycore.manga.domain;

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

    /** All known editions structurally linked to a catalog Series (see {@link MangaEdition#entityId()}) - unlike
     * {@link #findBySeriesTitle}, never a text-matching fallback: only editions actually attached. */
    List<MangaEdition> findByEntityId(UUID entityId);

    /** All known editions - bulk read for a screen that shows the
     * progression of SEVERAL series at once (see Ma collection), instead of one
     * call per tile. The edition reference data is small by nature (one row per
     * edition actually filled in), never a volume-heavy table. */
    List<MangaEdition> findAll();

    /** One specific edition of a structurally-linked Series, by ID rather than by title (case-insensitive on
     * editionName) - the preferred lookup once a Series's {@code entityId} is known: unlike
     * {@link #findBySeriesAndEdition}, immune to the Series having been renamed since this edition was linked
     * (see {@code Entity.rename}). Never a text-matching fallback, same spirit as {@link #findByEntityId}. */
    Optional<MangaEdition> findByEntityIdAndEditionName(UUID entityId, String editionName);

    /**
     * Step 5 (Series -> Edition -> Volume model): deletes an Edition that has become empty of
     * any catalogued Volume. The caller is responsible for having already made sure that no
     * Variant references it anymore - if market data (MarketPriceObservation)
     * still references it, the FK constraint {@code market_price_observation.manga_edition_id}
     * rejects the deletion (see VariantDeletionService, which treats this case as "do not
     * cascade yet" rather than as an error).
     */
    void deleteById(UUID id);
}
