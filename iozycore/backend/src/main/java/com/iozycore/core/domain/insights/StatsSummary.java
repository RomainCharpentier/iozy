package com.iozycore.core.domain.insights;

import java.util.List;

/**
 * Aggregated statistics of the collection (UC6 of the design, Bounded
 * Context Insights). Computed on demand by direct aggregation
 * queries, not through a separate event-driven read model - at the scale
 * of a personal collection, the ceremony of a real event-driven
 * read-model would bring nothing (see step 8: the choice of a full
 * event-sourcing had already been dismissed as disproportionate).
 */
public record StatsSummary(
        long totalEntities,
        long totalActiveOwnerships,
        long wishlistCount,
        long experiencesThisYear,
        List<TypeStats> byType,
        List<TagCount> topTags
) {
    public record TypeStats(
            String entityTypeCode,
            String entityTypeLabel,
            long entityCount,
            long activeOwnershipCount,
            long experienceCount,
            Double averageRating
    ) {
    }

    public record TagCount(String label, long count) {
    }

    /**
     * One month of the "Evolution of my collection" (see StatsService.computeTimeline) -
     * counts only, never a monetary value: no purchase price field
     * exists yet on Ownership (see purchaseanalysis, which carries the prices
     * but only for analyzed listings, not for the owned collection).
     */
    public record MonthlyPoint(String month, long tomesAdded) {
    }
}
