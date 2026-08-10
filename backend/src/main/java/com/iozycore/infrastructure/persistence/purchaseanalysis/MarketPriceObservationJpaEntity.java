package com.iozycore.infrastructure.persistence.purchaseanalysis;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

/** See V4__purchase_analysis.sql. */
@Entity
@Table(name = "market_price_observation")
public class MarketPriceObservationJpaEntity {

    @Id
    private UUID id;

    @Column(name = "manga_edition_id", nullable = false)
    private UUID mangaEditionId;

    @Column(name = "volume_range_start")
    private Integer volumeRangeStart;

    @Column(name = "volume_range_end")
    private Integer volumeRangeEnd;

    @Column(name = "observed_price", nullable = false)
    private BigDecimal observedPrice;

    @Column(nullable = false)
    private String platform;

    @Column(name = "observed_condition")
    private String observedCondition;

    @Column(name = "observed_at", nullable = false)
    private LocalDate observedAt;

    private String note;

    @Column(nullable = false)
    private String source;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected MarketPriceObservationJpaEntity() {
        // required by JPA
    }

    public MarketPriceObservationJpaEntity(UUID id, UUID mangaEditionId, Integer volumeRangeStart,
                                            Integer volumeRangeEnd, BigDecimal observedPrice, String platform,
                                            String observedCondition, LocalDate observedAt, String note,
                                            String source, Instant createdAt) {
        this.id = id;
        this.mangaEditionId = mangaEditionId;
        this.volumeRangeStart = volumeRangeStart;
        this.volumeRangeEnd = volumeRangeEnd;
        this.observedPrice = observedPrice;
        this.platform = platform;
        this.observedCondition = observedCondition;
        this.observedAt = observedAt;
        this.note = note;
        this.source = source;
        this.createdAt = createdAt;
    }

    public UUID getId() { return id; }
    public UUID getMangaEditionId() { return mangaEditionId; }
    public Integer getVolumeRangeStart() { return volumeRangeStart; }
    public Integer getVolumeRangeEnd() { return volumeRangeEnd; }
    public BigDecimal getObservedPrice() { return observedPrice; }
    public String getPlatform() { return platform; }
    public String getObservedCondition() { return observedCondition; }
    public LocalDate getObservedAt() { return observedAt; }
    public String getNote() { return note; }
    public String getSource() { return source; }
    public Instant getCreatedAt() { return createdAt; }
}
