package com.iozycore.manga.infrastructure.metadata;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface VolumeSearchCacheJpaRepository extends JpaRepository<VolumeSearchCacheJpaEntity, UUID> {

    Optional<VolumeSearchCacheJpaEntity> findByEntityTypeIdAndSeriesTitleAndAuthor(
            UUID entityTypeId, String seriesTitle, String author);

    List<VolumeSearchCacheJpaEntity> findAllByEntityTypeIdAndSeriesTitleIn(UUID entityTypeId, Collection<String> seriesTitles);

    /** The key and the freshness only: the JSON of the volumes is not loaded (projection interface). */
    List<CacheKeyView> findAllByEntityTypeId(UUID entityTypeId);

    interface CacheKeyView {
        String getSeriesTitle();

        String getAuthor();

        Instant getFetchedAt();
    }
}
