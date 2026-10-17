package com.iozycore.manga.infrastructure.deals;

import com.iozycore.manga.domain.deals.AiPriceEstimate;
import com.iozycore.manga.domain.deals.AiPriceEstimateCacheRepository;
import com.iozycore.manga.domain.deals.Condition;
import com.iozycore.manga.domain.deals.ConfidenceLevel;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

@Repository
@Transactional
@RequiredArgsConstructor
public class JpaAiPriceEstimateCacheRepositoryAdapter implements AiPriceEstimateCacheRepository {

    private final AiPriceEstimateCacheJpaRepository jpaRepository;

    @Override
    public Optional<AiPriceEstimate> find(String seriesTitle, String editionName, Condition condition) {
        return jpaRepository
                .findBySeriesTitleAndEditionNameAndItemCondition(seriesTitle, editionName, condition.name())
                .map(jpa -> new AiPriceEstimate(jpa.getPricePerVolume(),
                        ConfidenceLevel.valueOf(jpa.getConfidence()), jpa.getRationale()));
    }

    @Override
    public void save(String seriesTitle, String editionName, Condition condition, AiPriceEstimate estimate) {
        // Upsert: reuses the existing id for this key, otherwise creates a
        // new one - never two rows for the same key (UNIQUE constraint,
        // see V23__ai_price_estimate_cache.sql). Same action as in the cache of
        // volume searches.
        UUID id = jpaRepository
                .findBySeriesTitleAndEditionNameAndItemCondition(seriesTitle, editionName, condition.name())
                .map(AiPriceEstimateCacheJpaEntity::getId)
                .orElseGet(UUID::randomUUID);
        jpaRepository.save(new AiPriceEstimateCacheJpaEntity(id, seriesTitle, editionName, condition.name(),
                estimate.pricePerVolume(), estimate.confidence().name(), estimate.rationale(), Instant.now()));
    }
}
