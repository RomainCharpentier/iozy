package com.iozycore.manga.infrastructure.deals;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface AiPriceEstimateCacheJpaRepository extends JpaRepository<AiPriceEstimateCacheJpaEntity, UUID> {

    Optional<AiPriceEstimateCacheJpaEntity> findBySeriesTitleAndEditionNameAndItemCondition(
            String seriesTitle, String editionName, String itemCondition);
}
