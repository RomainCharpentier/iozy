package com.iozycore.purchaseanalysis;

import com.iozycore.domain.catalog.MangaEdition;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * Interprets every {@link MarketPriceObservation} as a PER-VOLUME price (an
 * observation's {@code observedPrice} divided by its scope's volume count,
 * or by the edition's total volume count when the observation has no
 * scope) so that {@link CompletenessCalculator} can price missing volumes
 * consistently regardless of how the user originally entered the
 * observation (a single tome, a range, or a whole lot). Pure, no Spring/
 * JPA/HTTP dependency - shared by {@link PurchaseAnalysisEngine} (a listing
 * being evaluated) and {@code PurchaseAnalysisService#computeCompleteness}
 * (a series already in the user's own collection).
 */
public class MarketPriceCalculator {

    public MarketPrice computePerVolume(MangaEdition edition, List<MarketPriceObservation> observations) {
        return computePerVolume(edition, observations, null);
    }

    /**
     * @param aiEstimate Phase 2 (assistance IA, project memory) - used only when there is no usable real
     *                    observation ({@code perVolumePrices} empty below): real data always wins over an AI
     *                    guess. {@code null} when no AI provider is configured or it had nothing to offer.
     */
    public MarketPrice computePerVolume(MangaEdition edition, List<MarketPriceObservation> observations,
                                         AiPriceEstimate aiEstimate) {
        List<BigDecimal> perVolumePrices = new ArrayList<>();
        for (MarketPriceObservation observation : observations) {
            // Written as an if/else (not a nested ternary) on purpose: mixing an
            // int-returning branch (.size()) with an Integer-returning one
            // (edition.totalVolumes(), nullable) in the same ternary forces
            // Java's binary numeric promotion to unbox the Integer branch even
            // when its runtime value is null, throwing an NPE before the
            // null-check below ever runs (caught by
            // MarketPriceCalculatorTest#an_observation_that_cannot_be_normalized_is_simply_ignored_never_invented).
            Integer volumeCount;
            if (observation.scope() != null) {
                volumeCount = observation.scope().expand().size();
            } else if (edition != null) {
                volumeCount = edition.totalVolumes();
            } else {
                volumeCount = null;
            }
            if (volumeCount != null && volumeCount > 0) {
                perVolumePrices.add(observation.observedPrice().divide(BigDecimal.valueOf(volumeCount), 2, RoundingMode.HALF_UP));
            }
        }

        BigDecimal theoretical = edition != null ? edition.retailPriceNewPerVolume() : null;
        if (perVolumePrices.isEmpty()) {
            // Un avis SANS chiffre ("je ne sais pas", voir AiPriceEstimate) est une reponse, mais
            // pas un prix : il ne peut pas fonder une base AI_ESTIMATED. On retombe alors sur le
            // theorique, exactement comme si l'IA n'avait pas ete consultee.
            if (aiEstimate != null && aiEstimate.pricePerVolume() != null) {
                return MarketPrice.aiEstimated(aiEstimate.pricePerVolume(), theoretical, aiEstimate.confidence());
            }
            return MarketPrice.noObservations(theoretical, ConfidenceLevel.LOW);
        }

        Collections.sort(perVolumePrices);
        BigDecimal median = median(perVolumePrices);
        BigDecimal low = perVolumePrices.get(0);
        BigDecimal high = perVolumePrices.get(perVolumePrices.size() - 1);
        ConfidenceLevel confidence = perVolumePrices.size() >= 3 ? ConfidenceLevel.HIGH : ConfidenceLevel.MEDIUM;
        return MarketPrice.fromObservations(perVolumePrices.size(), median, low, high, theoretical, confidence);
    }

    private static BigDecimal median(List<BigDecimal> sortedValues) {
        int size = sortedValues.size();
        if (size % 2 == 1) {
            return sortedValues.get(size / 2);
        }
        return sortedValues.get(size / 2 - 1).add(sortedValues.get(size / 2))
                .divide(BigDecimal.valueOf(2), 2, RoundingMode.HALF_UP);
    }
}
