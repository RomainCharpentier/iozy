package com.iozycore.manga.domain.deals;

import java.math.BigDecimal;
import java.util.Set;

/**
 * "Lot analysis" (feature brainstorm) - duplicates between a
 * {@link ListingItem} and the volumes already owned (see
 * {@link MangaSeries#knownEntityId()}, planned for this from the start but
 * never used until now) - see {@link DuplicateDetector}.
 * <p>
 * Deliberately additive: never affects {@link NegotiationRecommendation}
 * or {@link Verdict} (whose calculations are checked against the numbered
 * examples of the specification) - one more piece of advisory information,
 * never a rewrite of the score engine that is already validated.
 *
 * @param duplicateVolumeNumbers volumes of the lot already owned (active, neither sold nor lost)
 * @param usefulVolumeCount      includedVolumes minus the duplicates - never negative
 * @param pricePerUsefulVolume   itemCostShare spread over the useful volumes only - null if there is no
 *                               useful volume, or if itemCostShare itself is unknown
 * @param maxWorthwhilePrice     up to which price this lot stays interesting given the duplicates -
 *                               perVolumeMarketPrice (observed or theoretical, never made up) multiplied
 *                               by usefulVolumeCount; null if no useful volume or unknown price per volume
 */
public record DuplicateAnalysis(Set<Integer> duplicateVolumeNumbers, int usefulVolumeCount,
                                 BigDecimal pricePerUsefulVolume, BigDecimal maxWorthwhilePrice) {
    public DuplicateAnalysis {
        duplicateVolumeNumbers = duplicateVolumeNumbers == null ? Set.of() : Set.copyOf(duplicateVolumeNumbers);
    }

    public boolean hasDuplicates() {
        return !duplicateVolumeNumbers.isEmpty();
    }
}
