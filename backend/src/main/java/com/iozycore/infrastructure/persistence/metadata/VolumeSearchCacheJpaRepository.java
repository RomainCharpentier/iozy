package com.iozycore.infrastructure.persistence.metadata;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface VolumeSearchCacheJpaRepository extends JpaRepository<VolumeSearchCacheJpaEntity, UUID> {

    Optional<VolumeSearchCacheJpaEntity> findByEntityTypeIdAndSeriesTitleAndAuthor(
            UUID entityTypeId, String seriesTitle, String author);
}
