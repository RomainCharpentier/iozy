package com.iozycore.manga.infrastructure.deals;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import lombok.Getter;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/** See V23__ai_price_estimate_cache.sql - series_title/edition_name are stored
 * already normalised (trim + lowercase), never displayed as is. A null
 * price_per_volume is an answer ("I do not know"), not an absence. */
@Entity
@Table(name = "ai_price_estimate_cache")
@Getter
public class AiPriceEstimateCacheJpaEntity {

    @Id
    private UUID id;

    @Column(name = "series_title", nullable = false)
    private String seriesTitle;

    @Column(name = "edition_name", nullable = false)
    private String editionName;

    @Column(name = "item_condition", nullable = false)
    private String itemCondition;

    @Column(name = "price_per_volume")
    private BigDecimal pricePerVolume;

    @Column(nullable = false)
    private String confidence;

    @Column(columnDefinition = "text")
    private String rationale;

    @Column(name = "fetched_at", nullable = false)
    private Instant fetchedAt;

    protected AiPriceEstimateCacheJpaEntity() {
        // required by JPA
    }

    public AiPriceEstimateCacheJpaEntity(UUID id, String seriesTitle, String editionName, String itemCondition,
                                          BigDecimal pricePerVolume, String confidence, String rationale,
                                          Instant fetchedAt) {
        this.id = id;
        this.seriesTitle = seriesTitle;
        this.editionName = editionName;
        this.itemCondition = itemCondition;
        this.pricePerVolume = pricePerVolume;
        this.confidence = confidence;
        this.rationale = rationale;
        this.fetchedAt = fetchedAt;
    }
}
