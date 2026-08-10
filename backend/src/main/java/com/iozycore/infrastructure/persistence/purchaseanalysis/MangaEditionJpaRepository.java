package com.iozycore.infrastructure.persistence.purchaseanalysis;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface MangaEditionJpaRepository extends JpaRepository<MangaEditionJpaEntity, UUID> {
    Optional<MangaEditionJpaEntity> findBySeriesTitleIgnoreCaseAndEditionNameIgnoreCase(String seriesTitle, String editionName);
    List<MangaEditionJpaEntity> findBySeriesTitleIgnoreCase(String seriesTitle);
}
