package com.iozycore.manga.domain.deals;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Set;
import java.util.TreeSet;

/**
 * "Lot analysis" - detects the duplicates between the volumes of a
 * {@link ListingItem} and those already owned in the collection (see
 * {@link DuplicateAnalysis}). Pure, like {@link CompletenessCalculator} -
 * never reads the catalogue directly, receives the owned volumes
 * already resolved by {@code PurchaseAnalysisService}.
 */
public class DuplicateDetector {

    public DuplicateAnalysis detect(Set<Integer> includedVolumes, Set<Integer> alreadyOwnedVolumes,
                                     BigDecimal itemCostShare, MarketPrice perVolumeMarketPrice) {
        Set<Integer> duplicates = new TreeSet<>(includedVolumes);
        duplicates.retainAll(alreadyOwnedVolumes == null ? Set.of() : alreadyOwnedVolumes);

        int usefulVolumeCount = includedVolumes.size() - duplicates.size();

        BigDecimal pricePerUsefulVolume = usefulVolumeCount > 0 && itemCostShare != null
                ? itemCostShare.divide(BigDecimal.valueOf(usefulVolumeCount), 2, RoundingMode.HALF_UP)
                : null;

        BigDecimal perVolumeEstimate = perVolumeMarketPrice != null ? perVolumeMarketPrice.bestEstimate() : null;
        BigDecimal maxWorthwhilePrice = usefulVolumeCount > 0 && perVolumeEstimate != null
                ? perVolumeEstimate.multiply(BigDecimal.valueOf(usefulVolumeCount))
                : null;

        return new DuplicateAnalysis(duplicates, usefulVolumeCount, pricePerUsefulVolume, maxWorthwhilePrice);
    }
}
