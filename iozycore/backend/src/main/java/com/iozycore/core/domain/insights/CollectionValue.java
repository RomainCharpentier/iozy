package com.iozycore.core.domain.insights;

import java.math.BigDecimal;
import java.util.List;

/**
 * "Automatic computation of the collection value" (§15 V2 of the design
 * document) - see StatsService.computeCollectionValue. Only includes
 * the possessions currently owned (OWNED): the value of the collection
 * as it exists today, not a cumulative history of purchases.
 * <p>
 * {@code totalKnownValue} is NEVER presented as the real total
 * value of the collection - {@code pricedOwnershipCount} against
 * {@code totalActiveOwnershipCount} always shows how many possessions
 * have a price filled in, to never let anyone believe that a partial total
 * is complete (same principle as Purchase Analysis: never any invented
 * data, or data presented as more certain than it is).
 */
public record CollectionValue(
        BigDecimal totalKnownValue,
        long pricedOwnershipCount,
        long totalActiveOwnershipCount,
        List<TypeValue> byType
) {
    public record TypeValue(String entityTypeLabel, BigDecimal knownValue, long pricedCount, long totalCount) {
    }
}
