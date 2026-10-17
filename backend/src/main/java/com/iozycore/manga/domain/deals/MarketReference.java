package com.iozycore.manga.domain.deals;

import com.iozycore.manga.domain.MangaEdition;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * The benchmark that the <b>price of a listing</b> is compared to, with everything
 * needed to judge it: how many comparables, where they come from, which
 * lot shape they match, and how much they agree with each other.
 *
 * <h2>A number is not enough</h2>
 * "70 EUR" cannot be discussed. "70 EUR, from 4 comparable lots of 10 to
 * 14 volumes, observed in the last six months, tight within 12 %" can be
 * discussed - and corrected. This is why the sample, the source and the
 * spread travel with the price instead of staying in the calculation.
 *
 * <h2>What it refuses to do</h2>
 * Build itself from anything other than prices that were really observed. An
 * AI estimate and a catalogue new price stay useful elsewhere (cost to
 * complete, negotiation, verdict), but neither becomes "the
 * market": see {@link MarketReferenceSource}.
 *
 * @param price          reference for the whole lot assessed, without fees - {@code null} if unavailable
 * @param sampleSize     INDEPENDENT comparable listings; for a multi-series lot, that of the
 *                       least documented series. Never a number of rows in the database: five observations
 *                       of the same offer followed over time make one comparable, not five.
 * @param temporalCount  comparable observations before grouping by listing - the gap with
 *                       {@code sampleSize} says how many offers were followed several times
 * @param examinedCount  observations examined before filtering - to say "3 exist, 0 comparable" rather than "no data"
 * @param spreadPercent  high/low gap relative to the median, {@code null} under two comparables
 */
public record MarketReference(BigDecimal price, MarketReferenceConfidence confidence, int sampleSize,
                               int temporalCount, int examinedCount, MarketReferenceSource source,
                               LotShape comparedShape, Integer spreadPercent, LocalDate mostRecentObservation,
                               ReferenceGap gap) {

    /** Beyond this, the comparables tell things too different for a safe median to be drawn from them. */
    static final int DISPERSION_FORTE_PERCENT = 60;

    /** From this number of comparables, the sample stops being anecdotal. */
    static final int ECHANTILLON_SOLIDE = 3;

    public MarketReference {
        if (price == null && confidence != null && confidence.allowsPositioning()) {
            throw new IllegalArgumentException("Une référence sans prix ne peut pas servir à positionner");
        }
        confidence = confidence == null ? MarketReferenceConfidence.UNAVAILABLE : confidence;
        source = source == null ? MarketReferenceSource.NOT_RECORDED : source;
        gap = gap == null ? ReferenceGap.NOT_RECORDED : gap;
    }

    /** No reference, and the exact reason for its absence. */
    public static MarketReference unavailable(ReferenceGap gap, int examinedCount) {
        return new MarketReference(null, MarketReferenceConfidence.UNAVAILABLE, 0, 0, examinedCount,
                MarketReferenceSource.NONE, null, null, null, gap);
    }

    /**
     * Builds the reference of ONE series from comparables already filtered
     * by {@link MarketComparableSelector}.
     * <p>
     * The per-volume normalisation remains, but it now applies only between
     * products of the same shape and of a close size: reducing a single volume and
     * a complete set to it was the flaw; applying it from a lot of 10 to a lot of
     * 14 stays a reasonable approximation, and the confidence takes it into account.
     *
     * @param targetVolumeCount volumes of the listing assessed - the reference is returned for THIS volume
     */
    public static MarketReference fromComparables(MangaEdition edition, int targetVolumeCount,
                                                   MarketComparableSelector.Selection selection, LocalDate today) {
        if (selection.isEmpty()) {
            return unavailable(selection.gap(), selection.examined());
        }

        List<BigDecimal> parTome = new ArrayList<>();
        LocalDate plusRecent = null;
        for (MarketPriceObservation observation : selection.retained()) {
            int tomes = MarketComparableSelector.nombreDeTomes(observation, edition);
            if (tomes <= 0) {
                continue;
            }
            parTome.add(observation.observedPrice().divide(BigDecimal.valueOf(tomes), 2, RoundingMode.HALF_UP));
            if (plusRecent == null || observation.observedAt().isAfter(plusRecent)) {
                plusRecent = observation.observedAt();
            }
        }
        if (parTome.isEmpty()) {
            return unavailable(ReferenceGap.NO_COMPARABLE_SHAPE, selection.examined());
        }

        Collections.sort(parTome);
        BigDecimal mediane = mediane(parTome);
        Integer dispersion = dispersionPercent(parTome, mediane);

        MarketReferenceConfidence confiance = confiance(parTome.size(), dispersion,
                MarketComparableSelector.toutEstAncien(selection.retained(), today), edition);

        BigDecimal prixDuLot = mediane.multiply(BigDecimal.valueOf(targetVolumeCount))
                .setScale(2, RoundingMode.HALF_UP);

        return new MarketReference(prixDuLot, confiance, parTome.size(), selection.temporalCount(),
                selection.examined(), MarketReferenceSource.OBSERVED_COMPARABLES,
                LotShape.of(targetVolumeCount, edition.totalVolumes()), dispersion, plusRecent, ReferenceGap.NONE);
    }

    /**
     * The confidence, built then degraded - never the other way round.
     * <p>
     * The starting point is the sample, because that is what makes a
     * median mean something. Each reservation then lowers it by
     * one level: comparables that contradict each other, comparables a year
     * old, an edition whose number of volumes is unknown - so we cannot
     * say that a lot is not a complete set.
     */
    private static MarketReferenceConfidence confiance(int taille, Integer dispersion, boolean toutAncien,
                                                        MangaEdition edition) {
        MarketReferenceConfidence niveau = taille >= ECHANTILLON_SOLIDE
                ? MarketReferenceConfidence.HIGH
                : (taille >= 2 ? MarketReferenceConfidence.MEDIUM : MarketReferenceConfidence.LOW);

        if (dispersion != null && dispersion > DISPERSION_FORTE_PERCENT) {
            niveau = niveau.degraded();
        }
        if (toutAncien) {
            niveau = niveau.degraded();
        }
        if (edition.totalVolumes() == null || edition.totalVolumes() <= 0) {
            niveau = niveau.cappedAt(MarketReferenceConfidence.MEDIUM);
        }
        return niveau;
    }

    /**
     * Adds up the references of the series of a lot.
     * <p>
     * Returns unavailable as soon as a single series does not have its own: adding up
     * what we know while ignoring the rest would produce a reference
     * that is always too low, so a lot that is always "too expensive".
     * And the total never goes above MEDIUM beyond one series - putting unit
     * references side by side to judge a lot stays an approximation, even
     * when each term is solid.
     */
    public static MarketReference sum(List<MarketReference> parSerie) {
        if (parSerie == null || parSerie.isEmpty()) {
            return unavailable(ReferenceGap.NO_OBSERVATION, 0);
        }
        // A single series: nothing to add up, and above all nothing to overwrite. A
        // LOW reference - a single comparable, scattered comparables -
        // is still information: it does not place a price, but it
        // allows us to say "a single comparable" rather than "no data".
        if (parSerie.size() == 1) {
            return parSerie.get(0);
        }
        BigDecimal total = BigDecimal.ZERO;
        MarketReferenceConfidence pire = MarketReferenceConfidence.HIGH;
        int echantillonMin = Integer.MAX_VALUE;
        int temporels = 0;
        int examines = 0;
        LotShape forme = parSerie.size() == 1 ? parSerie.get(0).comparedShape() : null;
        Integer dispersionMax = null;
        LocalDate plusRecent = null;

        for (MarketReference reference : parSerie) {
            examines += reference.examinedCount();
            temporels += reference.temporalCount();
            if (reference.price() == null || !reference.confidence().allowsPositioning()) {
                // A series without a usable reference is enough to disqualify the lot.
                return new MarketReference(null, MarketReferenceConfidence.UNAVAILABLE, 0, 0, examines,
                        MarketReferenceSource.NONE, null, null, null, ReferenceGap.INCOMPLETE_LOT_COVERAGE);
            }
            total = total.add(reference.price());
            if (reference.confidence().compareTo(pire) > 0) {
                pire = reference.confidence();
            }
            echantillonMin = Math.min(echantillonMin, reference.sampleSize());
            if (reference.spreadPercent() != null
                    && (dispersionMax == null || reference.spreadPercent() > dispersionMax)) {
                dispersionMax = reference.spreadPercent();
            }
            if (reference.mostRecentObservation() != null
                    && (plusRecent == null || reference.mostRecentObservation().isAfter(plusRecent))) {
                plusRecent = reference.mostRecentObservation();
            }
        }

        MarketReferenceConfidence confiance = parSerie.size() > 1
                ? pire.cappedAt(MarketReferenceConfidence.MEDIUM)
                : pire;
        return new MarketReference(total, confiance, echantillonMin, temporels, examines,
                MarketReferenceSource.OBSERVED_COMPARABLES, forme, dispersionMax, plusRecent, ReferenceGap.NONE);
    }

    private static BigDecimal mediane(List<BigDecimal> triees) {
        int taille = triees.size();
        if (taille % 2 == 1) {
            return triees.get(taille / 2);
        }
        return triees.get(taille / 2 - 1).add(triees.get(taille / 2))
                .divide(BigDecimal.valueOf(2), 2, RoundingMode.HALF_UP);
    }

    /** The amplitude of the comparables, relative to their median. Under two values, the notion does not exist. */
    private static Integer dispersionPercent(List<BigDecimal> triees, BigDecimal mediane) {
        if (triees.size() < 2 || mediane.signum() <= 0) {
            return null;
        }
        return triees.get(triees.size() - 1).subtract(triees.get(0))
                .multiply(BigDecimal.valueOf(100))
                .divide(mediane, 0, RoundingMode.HALF_UP)
                .intValue();
    }

    /** True when this reference can be used to place a price - the only test to do before comparing. */
    @com.fasterxml.jackson.annotation.JsonIgnore
    public boolean isUsable() {
        return price != null && confidence.allowsPositioning();
    }
}
