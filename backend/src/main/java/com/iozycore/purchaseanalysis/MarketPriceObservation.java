package com.iozycore.purchaseanalysis;

import com.iozycore.domain.catalog.MangaEdition;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

/**
 * One real, manually-entered price observation for a {@link MangaEdition} -
 * an append-only log, never modified after creation. This is the ONLY
 * source of {@link PriceBasis#OBSERVED_MARKET} data in Phase 1, since no
 * viable public API exists for Vinted/Leboncoin/Rakuten (see
 * {@link PurchaseAnalysisEngine}) - a future automated source would write
 * into this same log with a different {@code source} value, without
 * changing anything downstream.
 *
 * @param scope nullable - null means the observation covers the whole edition/lot rather than a specific volume range
 */
public record MarketPriceObservation(UUID id, UUID mangaEditionId, VolumeRange scope, BigDecimal observedPrice,
                                      ListingPlatform platform, Condition observedCondition, LocalDate observedAt,
                                      String note, Instant createdAt) {
    public MarketPriceObservation {
        if (mangaEditionId == null) {
            throw new IllegalArgumentException("A market price observation must reference a manga edition");
        }
        if (observedPrice == null || observedPrice.signum() < 0) {
            throw new IllegalArgumentException("Observed price must be zero or positive");
        }
        if (observedAt == null) {
            throw new IllegalArgumentException("A market price observation must have an observation date");
        }
    }

    public static MarketPriceObservation record_(UUID mangaEditionId, VolumeRange scope, BigDecimal observedPrice,
                                                   ListingPlatform platform, Condition observedCondition,
                                                   LocalDate observedAt, String note) {
        return new MarketPriceObservation(UUID.randomUUID(), mangaEditionId, scope, observedPrice, platform,
                observedCondition, observedAt, note, Instant.now());
    }
}
