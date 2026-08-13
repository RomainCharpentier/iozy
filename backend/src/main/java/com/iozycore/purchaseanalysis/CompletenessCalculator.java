package com.iozycore.purchaseanalysis;

import java.math.BigDecimal;
import java.util.List;
import java.util.Set;
import java.util.TreeSet;

/**
 * Computes {@link CollectionStatus} for a set of already-owned/included
 * volumes against a matched edition - always per edition, never at the
 * series/work level (see {@link CollectionStatus}). Pure, no Spring/JPA/
 * HTTP dependency, so it can be instantiated directly in tests. Reused both
 * by {@link PurchaseAnalysisEngine} (for a listing being evaluated) and by
 * {@code PurchaseAnalysisService#computeCompleteness} (for a series already
 * in the user's own collection - see "coût pour compléter une série").
 */
public class CompletenessCalculator {

    /**
     * @param includedVolumes   volume numbers already owned/included, whichever is being evaluated
     * @param edition           nullable - completeness cannot be computed without a matched edition
     * @param perVolumeMarketPrice the per-volume {@link MarketPrice} for this edition (see
     *                          {@link PurchaseAnalysisEngine}) - used to price the missing volumes,
     *                          preferring a real observation over the edition's retail price
     */
    public CollectionStatus compute(Set<Integer> includedVolumes, MangaEdition edition, MarketPrice perVolumeMarketPrice) {
        if (edition == null || edition.totalVolumes() == null) {
            return new CollectionStatus(edition, null, null, List.of(), null, null);
        }

        int totalVolumes = edition.totalVolumes();
        TreeSet<Integer> missing = new TreeSet<>();
        for (int volume = 1; volume <= totalVolumes; volume++) {
            if (!includedVolumes.contains(volume)) {
                missing.add(volume);
            }
        }
        List<Integer> missingVolumeNumbers = List.copyOf(missing);
        int missingCount = missingVolumeNumbers.size();

        if (missingCount == 0) {
            // Nothing left to price - complete regardless of whether any price data exists.
            return new CollectionStatus(edition, totalVolumes, 0, missingVolumeNumbers, BigDecimal.ZERO, null);
        }

        BigDecimal perVolumePrice = null;
        PriceBasis basis = null;
        if (perVolumeMarketPrice != null) {
            if (perVolumeMarketPrice.basis() == PriceBasis.OBSERVED_MARKET) {
                perVolumePrice = perVolumeMarketPrice.observedMedian();
                basis = PriceBasis.OBSERVED_MARKET;
            } else if (perVolumeMarketPrice.basis() == PriceBasis.AI_ESTIMATED) {
                perVolumePrice = perVolumeMarketPrice.aiEstimatedPrice();
                basis = PriceBasis.AI_ESTIMATED;
            } else if (perVolumeMarketPrice.theoreticalEstimate() != null) {
                perVolumePrice = perVolumeMarketPrice.theoreticalEstimate();
                basis = PriceBasis.THEORETICAL_ONLY;
            }
        }

        BigDecimal costToComplete = perVolumePrice != null
                ? perVolumePrice.multiply(BigDecimal.valueOf(missingCount))
                : null;

        return new CollectionStatus(edition, totalVolumes, missingCount, missingVolumeNumbers,
                costToComplete, costToComplete != null ? basis : null);
    }
}
