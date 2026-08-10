package com.iozycore.purchaseanalysis;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/**
 * Reference data for one French edition of one series (e.g. "Death Note" /
 * "Black Edition") - populated progressively by the user the first time an
 * analysis references an edition unknown to the system (see
 * {@link PurchaseAnalysisService}), then reused for every later analysis.
 * <p>
 * {@code totalVolumes} is {@code null} when genuinely unknown - never
 * defaulted to 0, which would wrongly read as "this edition has no
 * volumes" instead of "completeness cannot be computed yet".
 */
public record MangaEdition(UUID id, String seriesTitle, String editionName, EditionTier tier, String publisher,
                            Integer totalVolumes, BigDecimal retailPriceNewPerVolume, boolean outOfPrint,
                            boolean betterEditionAnnounced, String betterEditionNote, String languageCode,
                            Instant createdAt, Instant updatedAt) {

    public MangaEdition {
        if (seriesTitle == null || seriesTitle.isBlank()) {
            throw new IllegalArgumentException("A manga edition must reference a series title");
        }
        if (editionName == null || editionName.isBlank()) {
            throw new IllegalArgumentException("A manga edition must have a name");
        }
        if (totalVolumes != null && totalVolumes < 1) {
            throw new IllegalArgumentException("totalVolumes must be at least 1 when known");
        }
        if (retailPriceNewPerVolume != null && retailPriceNewPerVolume.signum() < 0) {
            throw new IllegalArgumentException("retailPriceNewPerVolume cannot be negative");
        }
        languageCode = languageCode == null || languageCode.isBlank() ? "fr" : languageCode;
    }

    public static MangaEdition create(String seriesTitle, String editionName, EditionTier tier, String publisher,
                                       Integer totalVolumes, BigDecimal retailPriceNewPerVolume, boolean outOfPrint,
                                       boolean betterEditionAnnounced, String betterEditionNote) {
        Instant now = Instant.now();
        return new MangaEdition(UUID.randomUUID(), seriesTitle, editionName, tier, publisher, totalVolumes,
                retailPriceNewPerVolume, outOfPrint, betterEditionAnnounced, betterEditionNote, "fr", now, now);
    }

    /** Partial update (progressive enrichment) - any {@code null} argument keeps the current value. */
    public MangaEdition withUpdatedReferenceData(EditionTier tier, String publisher, Integer totalVolumes,
                                                  BigDecimal retailPriceNewPerVolume, Boolean outOfPrint,
                                                  Boolean betterEditionAnnounced, String betterEditionNote) {
        return new MangaEdition(id, seriesTitle, editionName,
                tier != null ? tier : this.tier,
                publisher != null ? publisher : this.publisher,
                totalVolumes != null ? totalVolumes : this.totalVolumes,
                retailPriceNewPerVolume != null ? retailPriceNewPerVolume : this.retailPriceNewPerVolume,
                outOfPrint != null ? outOfPrint : this.outOfPrint,
                betterEditionAnnounced != null ? betterEditionAnnounced : this.betterEditionAnnounced,
                betterEditionNote != null ? betterEditionNote : this.betterEditionNote,
                languageCode, createdAt, Instant.now());
    }
}
