package com.iozycore.manga.infrastructure.deals;

import jakarta.persistence.Column;
import lombok.Getter;
import org.hibernate.annotations.TenantId;
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
@Getter
public class MarketPriceObservationJpaEntity {

    @Id
    private UUID id;

    // Separation by owner (V26): Hibernate adds this column
    // to the WHERE clause of every query on this entity, and fills it in at
    // insert time from ProprietaireCourant.
    @TenantId
    @Column(name = "owner_id", nullable = false)
    private UUID ownerId;

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

    /** See V18: former column `source`, written hard-coded and never read again, now the real origin. */
    @Column(nullable = false)
    private String origin;

    @Column(name = "volume_count")
    private Integer volumeCount;

    @Column(name = "listing_identity")
    private String listingIdentity;

    @Column(name = "source_url")
    private String sourceUrl;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected MarketPriceObservationJpaEntity() {
        // required by JPA
    }

    public MarketPriceObservationJpaEntity(UUID id, UUID mangaEditionId, Integer volumeRangeStart,
                                            Integer volumeRangeEnd, BigDecimal observedPrice, String platform,
                                            String observedCondition, LocalDate observedAt, String note,
                                            String origin, Instant createdAt, Integer volumeCount,
                                            String listingIdentity, String sourceUrl) {
        this.id = id;
        this.mangaEditionId = mangaEditionId;
        this.volumeRangeStart = volumeRangeStart;
        this.volumeRangeEnd = volumeRangeEnd;
        this.observedPrice = observedPrice;
        this.platform = platform;
        this.observedCondition = observedCondition;
        this.observedAt = observedAt;
        this.note = note;
        this.origin = origin;
        this.volumeCount = volumeCount;
        this.listingIdentity = listingIdentity;
        this.sourceUrl = sourceUrl;
        this.createdAt = createdAt;
    }
}
