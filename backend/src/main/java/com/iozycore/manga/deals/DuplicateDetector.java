package com.iozycore.manga.deals;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Set;
import java.util.TreeSet;

/**
 * "Analyse d'un lot" - détecte les doublons entre les tomes d'un
 * {@link ListingItem} et ceux déjà possédés dans la collection (voir
 * {@link DuplicateAnalysis}). Pure, comme {@link CompletenessCalculator} -
 * ne lit jamais directement le catalogue, reçoit les tomes déjà possédés
 * déjà résolus par {@link PurchaseAnalysisService}.
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
