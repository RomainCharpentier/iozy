package com.iozycore.purchaseanalysis;

import java.math.BigDecimal;
import java.math.RoundingMode;

/**
 * Les seuils métier de l'évaluation, réunis en un seul endroit.
 *
 * Ils vivent ici plutôt que dispersés dans les calculs pour qu'on puisse les
 * relire, les discuter et les tester sans lire le moteur. Les valeurs sont
 * propres à IozyCore et au marché du manga d'occasion : elles n'ont pas été
 * reprises d'ailleurs, où elles décriraient un autre marché.
 *
 * Une référence marché n'est utilisée que si sa confiance est suffisante -
 * comparer à une médiane tirée de deux annonces douteuses produit un chiffre
 * précis et faux, ce qui est pire qu'un « référence insuffisante ».
 */
public final class DealAssessmentPolicy {

    private DealAssessmentPolicy() {
    }

    /** Fractions de la référence délimitant les catégories de prix. */
    private static final BigDecimal TRES_BON = new BigDecimal("0.70");
    private static final BigDecimal BON = new BigDecimal("0.85");
    private static final BigDecimal CORRECT = new BigDecimal("1.10");
    private static final BigDecimal PLUTOT_CHER = new BigDecimal("1.35");

    /**
     * Situe un prix. Rend {@link PricePosition#REFERENCE_UNAVAILABLE} dès que
     * la référence manque ou n'est pas assez sûre - jamais une catégorie tirée
     * d'une donnée qu'on sait fragile.
     */
    public static PricePosition positionOf(BigDecimal askingPrice, BigDecimal reference, ConfidenceLevel confidence) {
        if (askingPrice == null || reference == null || reference.signum() <= 0
                || confidence == null || confidence == ConfidenceLevel.LOW) {
            return PricePosition.REFERENCE_UNAVAILABLE;
        }
        BigDecimal ratio = askingPrice.divide(reference, 4, RoundingMode.HALF_UP);
        if (ratio.compareTo(TRES_BON) < 0) return PricePosition.VERY_GOOD_PRICE;
        if (ratio.compareTo(BON) < 0) return PricePosition.GOOD_PRICE;
        if (ratio.compareTo(CORRECT) <= 0) return PricePosition.FAIR_PRICE;
        if (ratio.compareTo(PLUTOT_CHER) <= 0) return PricePosition.RATHER_EXPENSIVE;
        return PricePosition.TOO_EXPENSIVE;
    }

    /** L'écart à la référence, en pourcentage signé - la moitié de l'explication tient dans ce chiffre. */
    public static Integer deviationPercent(BigDecimal askingPrice, BigDecimal reference) {
        if (askingPrice == null || reference == null || reference.signum() <= 0) {
            return null;
        }
        return askingPrice.subtract(reference)
                .multiply(BigDecimal.valueOf(100))
                .divide(reference, 0, RoundingMode.HALF_UP)
                .intValue();
    }
}
