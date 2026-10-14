package com.iozycore.manga.infrastructure.catalog;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import lombok.Getter;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/** See V4__purchase_analysis.sql (table) and V10__manga_edition_entity_id.sql (entity_id column). */
@Entity
@Table(name = "manga_edition")
@Getter
public class MangaEditionJpaEntity {

    @Id
    private UUID id;

    @Column(name = "entity_id")
    private UUID entityId;

    @Column(name = "series_title", nullable = false)
    private String seriesTitle;

    @Column(name = "edition_name", nullable = false)
    private String editionName;

    @Column(name = "edition_tier", nullable = false)
    private String editionTier;

    private String publisher;

    @Column(name = "total_volumes")
    private Integer totalVolumes;

    @Column(name = "retail_price_new_per_volume")
    private BigDecimal retailPriceNewPerVolume;

    @Column(name = "out_of_print", nullable = false)
    private boolean outOfPrint;

    @Column(name = "better_edition_announced", nullable = false)
    private boolean betterEditionAnnounced;

    @Column(name = "better_edition_note")
    private String betterEditionNote;

    @Column(name = "language_code", nullable = false)
    private String languageCode;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected MangaEditionJpaEntity() {
        // required by JPA
    }

    public MangaEditionJpaEntity(UUID id, UUID entityId, String seriesTitle, String editionName, String editionTier,
                                  String publisher, Integer totalVolumes, BigDecimal retailPriceNewPerVolume,
                                  boolean outOfPrint, boolean betterEditionAnnounced, String betterEditionNote,
                                  String languageCode, Instant createdAt, Instant updatedAt) {
        this.id = id;
        this.entityId = entityId;
        this.seriesTitle = seriesTitle;
        this.editionName = editionName;
        this.editionTier = editionTier;
        this.publisher = publisher;
        this.totalVolumes = totalVolumes;
        this.retailPriceNewPerVolume = retailPriceNewPerVolume;
        this.outOfPrint = outOfPrint;
        this.betterEditionAnnounced = betterEditionAnnounced;
        this.betterEditionNote = betterEditionNote;
        this.languageCode = languageCode;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
    }

    public boolean isOutOfPrint() { return outOfPrint; }
    public boolean isBetterEditionAnnounced() { return betterEditionAnnounced; }
}
