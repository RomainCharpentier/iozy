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

    /** La clé et la fraîcheur seules : le JSON des tomes n'est pas chargé (projection d'interface). */
    List<CacheKeyView> findAllByEntityTypeId(UUID entityTypeId);

    interface CacheKeyView {
        String getSeriesTitle();

        String getAuthor();

        Instant getFetchedAt();
    }
}
