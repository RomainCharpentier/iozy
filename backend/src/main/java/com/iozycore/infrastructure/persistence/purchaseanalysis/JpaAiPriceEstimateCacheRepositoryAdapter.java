package com.iozycore.infrastructure.persistence.purchaseanalysis;

import com.iozycore.purchaseanalysis.AiPriceEstimate;
import com.iozycore.purchaseanalysis.AiPriceEstimateCacheRepository;
import com.iozycore.purchaseanalysis.Condition;
import com.iozycore.purchaseanalysis.ConfidenceLevel;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

@Repository
@Transactional
public class JpaAiPriceEstimateCacheRepositoryAdapter implements AiPriceEstimateCacheRepository {

    private final AiPriceEstimateCacheJpaRepository jpaRepository;

    public JpaAiPriceEstimateCacheRepositoryAdapter(AiPriceEstimateCacheJpaRepository jpaRepository) {
        this.jpaRepository = jpaRepository;
    }

    @Override
    public Optional<AiPriceEstimate> find(String seriesTitle, String editionName, Condition condition) {
        return jpaRepository
                .findBySeriesTitleAndEditionNameAndItemCondition(seriesTitle, editionName, condition.name())
                .map(jpa -> new AiPriceEstimate(jpa.getPricePerVolume(),
                        ConfidenceLevel.valueOf(jpa.getConfidence()), jpa.getRationale()));
    }

    @Override
    public void save(String seriesTitle, String editionName, Condition condition, AiPriceEstimate estimate) {
        // Upsert : réutilise l'id existant pour cette clé, sinon en crée une
        // nouvelle - jamais deux lignes pour la même clé (contrainte UNIQUE,
        // voir V23__ai_price_estimate_cache.sql). Même geste qu'au cache des
        // recherches de tomes.
        UUID id = jpaRepository
                .findBySeriesTitleAndEditionNameAndItemCondition(seriesTitle, editionName, condition.name())
                .map(AiPriceEstimateCacheJpaEntity::getId)
                .orElseGet(UUID::randomUUID);
        jpaRepository.save(new AiPriceEstimateCacheJpaEntity(id, seriesTitle, editionName, condition.name(),
                estimate.pricePerVolume(), estimate.confidence().name(), estimate.rationale(), Instant.now()));
    }
}
