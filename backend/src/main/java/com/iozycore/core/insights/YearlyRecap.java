package com.iozycore.core.insights;

import java.util.List;

/**
 * "Yearly recap" (My profile) - "84 volumes bought, 12 series started,
 * most present author..." over a given year (see
 * StatsService.computeYearlyRecap). Pure read like
 * StatsSummary/MonthlyPoint - no public/unauthenticated endpoint: the
 * "shareable" part is done by downloading the image generated on the client side
 * (see web/CollectionRecapPage), never through a public link exposing
 * the owner's data directly (no authentication system
 * exists yet in the app to tell "me" from "anyone").
 */
public record YearlyRecap(
        int year,
        long acquisitionsCount,
        List<TypeCount> acquisitionsByType,
        long seriesStartedCount,
        long experiencesCount,
        Double averageRating,
        String mostFeaturedCreator,
        long mostFeaturedCreatorCount,
        List<Integer> availableYears
) {
    public record TypeCount(String entityTypeLabel, long count) {
    }
}
