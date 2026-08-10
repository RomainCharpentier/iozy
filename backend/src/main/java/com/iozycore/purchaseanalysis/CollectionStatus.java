package com.iozycore.purchaseanalysis;

import com.fasterxml.jackson.annotation.JsonIgnore;

import java.math.BigDecimal;
import java.util.List;

/**
 * Completeness of one listing item against its {@link MangaEdition} -
 * ALWAYS computed per edition, never at the series/work level, since two
 * editions of the same series can have different volume counts.
 *
 * @param totalVolumes               null when the edition's total volume count is unknown - completeness
 *                                   cannot be computed in that case, see {@link #missingCount()}
 * @param missingCount               null when {@code totalVolumes} is unknown; 0 means the listing
 *                                   completes the edition entirely
 * @param estimatedCostToComplete    null when it cannot be computed (unknown total, or no price data at all) -
 *                                   {@link BigDecimal#ZERO} when the listing already completes the edition,
 *                                   regardless of whether any price data exists (nothing left to price)
 * @param costToCompleteBasis        null when {@code estimatedCostToComplete} is null, or when it is zero
 *                                   because the edition is already complete (no price was actually used)
 */
public record CollectionStatus(MangaEdition edition, Integer totalVolumes, Integer missingCount,
                                List<Integer> missingVolumeNumbers, BigDecimal estimatedCostToComplete,
                                PriceBasis costToCompleteBasis) {
    public CollectionStatus {
        missingVolumeNumbers = missingVolumeNumbers == null ? List.of() : List.copyOf(missingVolumeNumbers);
    }

    // @JsonIgnore on both: these are derived helpers, not real fields - without
    // it, Jackson's bean-getter auto-detection (isXxx() naming) serializes them
    // as extra JSON properties ("known"/"complete") that don't match any
    // canonical record component, which then breaks deserialization of the
    // JSONB payload with an UnrecognizedPropertyException (see
    // PurchaseAnalysisJpaEntity - caught by
    // PurchaseAnalysisPersistenceIntegrationTest after forcing a real cache
    // miss with entityManager.clear()).
    @JsonIgnore
    public boolean isComplete() {
        return missingCount != null && missingCount == 0;
    }

    @JsonIgnore
    public boolean isKnown() {
        return totalVolumes != null;
    }
}
