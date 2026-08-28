package com.iozycore.infrastructure.persistence.purchaseanalysis;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/** Voir V23__ai_price_estimate_cache.sql - series_title/edition_name sont stockés
 * déjà normalisés (trim + minuscules), jamais affichés tels quels. Un
 * price_per_volume nul est une réponse (« je ne sais pas »), pas une absence. */
@Entity
@Table(name = "ai_price_estimate_cache")
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
        // requis par JPA
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

    public UUID getId() { return id; }
    public BigDecimal getPricePerVolume() { return pricePerVolume; }
    public String getConfidence() { return confidence; }
    public String getRationale() { return rationale; }
}
