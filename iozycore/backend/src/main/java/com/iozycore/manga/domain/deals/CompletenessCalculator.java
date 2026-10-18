package com.iozycore.manga.domain.deals;

import com.iozycore.manga.domain.MangaEdition;

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
 * in the user's own collection - see "cost to complete a series").
 */
public class CompletenessCalculator {

    /**
     * @param includedVolumes   volume numbers already owned/included, whichever is being evaluated
     * @param edition           nullable - completeness cannot be computed without a matched edition
     * @param perVolumeMarketPrice the per-volume {@link MarketPrice} for this edition (see
     *                          {@link PurchaseAnalysisEngine}) - used to price the missing volumes,
     *                          preferring a real observation over the edition's retail price
     *
     * <p>Doesn't distinguish catalogued-but-unowned from purely virtual missing volumes (see
     * {@link CollectionStatus#cataloguedMissingVolumeNumbers()}) - meaningless for
     * {@link PurchaseAnalysisEngine}'s use (evaluating a third-party listing, no catalog concept
     * applies there). Own-collection callers should use
     * {@link #compute(Set, Set, MangaEdition, MarketPrice)} instead.
     */
    public CollectionStatus compute(Set<Integer> includedVolumes, MangaEdition edition, MarketPrice perVolumeMarketPrice) {
        return compute(includedVolumes, Set.of(), edition, perVolumeMarketPrice);
    }

    /**
     * @param cataloguedVolumes step 6/8 (Volume != Ownership model) - volume numbers that have a real
     *                          catalogued Variant (regardless of Ownership), used only to classify each
     *                          missing volume as catalogued-but-unowned vs purely virtual - never to
     *                          change {@code missingCount}/{@code missingVolumeNumbers} themselves
     */
    public CollectionStatus compute(Set<Integer> includedVolumes, Set<Integer> cataloguedVolumes, MangaEdition edition,
                                     MarketPrice perVolumeMarketPrice) {
        if (edition == null || edition.totalVolumes() == null) {
            return new CollectionStatus(edition, null, null, List.of(), List.of(), null, null);
        }

        int totalVolumes = edition.totalVolumes();
        TreeSet<Integer> missing = new TreeSet<>();
        for (int volume = 1; volume <= totalVolumes; volume++) {
            if (!includedVolumes.contains(volume)) {
                missing.add(volume);
            }
        }
        List<Integer> missingVolumeNumbers = List.copyOf(missing);
        List<Integer> cataloguedMissing = missingVolumeNumbers.stream().filter(cataloguedVolumes::contains).toList();
        int missingCount = missingVolumeNumbers.size();

        if (missingCount == 0) {
            // Nothing left to price - complete regardless of whether any price data exists.
            return new CollectionStatus(edition, totalVolumes, 0, missingVolumeNumbers, cataloguedMissing, BigDecimal.ZERO, null);
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

        return new CollectionStatus(edition, totalVolumes, missingCount, missingVolumeNumbers, cataloguedMissing,
                costToComplete, costToComplete != null ? basis : null);
    }
}
