package com.iozycore.manga.domain.deals;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * The three questions of a listing, kept separate, then a summary.
 *
 * <h2>Why three</h2>
 * "Does this lot bring me something?", "is this price good?" and
 * "is this listing clean?" cannot be answered together. A lot sold
 * cheap but entirely made of duplicates is a bad purchase at a good price. An expensive lot
 * that fills exactly the gaps can be worth the spending. A single
 * number would crush these cases onto each other, and this is exactly where
 * the user needs to see clearly.
 *
 * <h2>The summary does not replace the dimensions</h2>
 * {@link #headline()} gives the sentence that dominates the screen, but the three
 * dimensions stay readable next to it: this is what makes the verdict
 * explainable, and therefore open to discussion.
 *
 * <h2>Independent of Vinted</h2>
 * Built from numbers and text, whatever their origin.
 * A listing entered entirely by hand produces the same assessment.
 *
 * <h2>Two bases, never swapped</h2>
 * The price position is computed on the <b>listing price</b>, without
 * fees, because the comparables are too. What the lot brings
 * ({@link CollectionFit}) is computed on the <b>acquisition cost</b>, with fees
 * included, because this is what we pay. The factory below is the only
 * place where this separation is played out.
 *
 * @param referenceSampleSize comparables kept behind {@code referencePrice} - 0 when there are none
 * @param referenceSource     where the reference comes from, or {@code NOT_RECORDED} for an earlier analysis
 * @param referenceGap        what is missing when there is no reference, to say it usefully
 * @param referenceSpreadPercent    how much the comparables agree - high/low gap relative to
 *                                  the median, {@code null} under two comparables or for an analysis
 *                                  earlier than Batch 88
 * @param referenceMostRecentObservation the most recent of the observations kept: the freshness of the reference
 * @param referenceExaminedCount    observations EXAMINED before filtering - to say "3 exist, 0 comparable"
 *                                  rather than "no data". 0 for an analysis earlier than Batch 88
 */
public record ListingAssessment(CollectionFit collectionFit, PricePosition pricePosition,
                                 BigDecimal referencePrice, MarketReferenceConfidence referenceConfidence,
                                 Integer deviationPercent, ListingTrustAssessment trust, Headline headline,
                                 int referenceSampleSize, MarketReferenceSource referenceSource,
                                 ReferenceGap referenceGap, Integer referenceSpreadPercent,
                                 LocalDate referenceMostRecentObservation, int referenceExaminedCount) {

    public ListingAssessment {
        // Analyses saved before the origin was kept: we say
        // we do not know it rather than make up a source afterwards.
        // Same rule for the three reservations added in Batch 88: an old snapshot
        // did not carry them, it reads them back as null (0 for a count),
        // never rebuilt afterwards.
        referenceConfidence = referenceConfidence == null ? MarketReferenceConfidence.UNAVAILABLE : referenceConfidence;
        referenceSource = referenceSource == null ? MarketReferenceSource.NOT_RECORDED : referenceSource;
        referenceGap = referenceGap == null ? ReferenceGap.NOT_RECORDED : referenceGap;
    }

    /**
     * Computes the price position, the summary, and freezes everything.
     * <p>
     * Real components rather than derived methods: an analysis is saved
     * as JSONB, and a computed accessor would be serialized without being
     * readable back (a trap already met on CollectionStatus). Freezing it also guarantees
     * that an old analysis will always return the verdict it returned that
     * day, even if the rule changes later - it really is a snapshot.
     *
     * @param askingPrice the price OF THE LISTING, without fees. Never the acquisition
     *                    cost: the comparables being without fees, passing it
     *                    the total would reverse the verdict.
     */
    public static ListingAssessment of(CollectionFit collectionFit, MarketReference reference,
                                        BigDecimal askingPrice, ListingTrustAssessment trust) {
        MarketReference ref = reference == null
                ? MarketReference.unavailable(ReferenceGap.NO_OBSERVATION, 0)
                : reference;
        // A reference that cannot be used does not leave here: neither as a displayed price,
        // nor as a percentage gap. A displayed number is a number we
        // believe in.
        BigDecimal prixReference = ref.isUsable() ? ref.price() : null;
        PricePosition position = DealAssessmentPolicy.positionOf(askingPrice, ref);
        // The reservations travel WITH the price, as MarketReference promises in
        // its own header: "70 EUR" cannot be discussed, "70 EUR from
        // 4 comparables, recent observations, tight within 12 %" can be discussed -
        // and corrected. The sample and the source already travelled; the
        // spread, the freshness and the number of EXAMINED observations stayed
        // in the calculation, so invisible.
        return new ListingAssessment(collectionFit, position, prixReference, ref.confidence(),
                DealAssessmentPolicy.deviationPercent(askingPrice, prixReference), trust,
                synthese(collectionFit, position, trust),
                ref.sampleSize(), ref.source(), ref.gap(),
                ref.spreadPercent(), ref.mostRecentObservation(), ref.examinedCount());
    }

    /** The conclusion put forward. It names first what decides: the contribution, then the price. */
    public enum Headline {
        /** Nothing new for this collection - the price does not make up for that. */
        NOTHING_NEW_FOR_YOU,
        /** Many duplicates: limited interest, whatever the price. */
        LIMITED_INTEREST,
        /** A real contribution and a price that holds. */
        GOOD_FOR_YOUR_COLLECTION,
        /** A real contribution but a price that is too high. */
        USEFUL_BUT_EXPENSIVE,
        /** A real contribution, price impossible to place for lack of a reference. */
        USEFUL_PRICE_UNKNOWN,
        /** Strong signals: to check before anything else. */
        CHECK_BEFORE_BUYING,
        /** Nothing identified: the user must first confirm the content. */
        CONTENT_TO_CONFIRM
    }

    /**
     * The order matters, and it is deliberate.
     * <p>
     * A strong warning signal comes before everything: no point discussing a
     * price if the listing asks for a transfer outside the platform. Then comes
     * the contribution to the collection, because a lot that brings nothing is never
     * a good deal, however cheap it is. The price decides last,
     * once the interest is established.
     */
    private static Headline synthese(CollectionFit collectionFit, PricePosition pricePosition,
                                      ListingTrustAssessment trust) {
        if (trust != null && trust.level() == TrustLevel.CONCERNING) {
            return Headline.CHECK_BEFORE_BUYING;
        }
        if (collectionFit == null || !collectionFit.isKnown()) {
            return Headline.CONTENT_TO_CONFIRM;
        }
        return switch (collectionFit.interest()) {
            case NOTHING_NEW -> Headline.NOTHING_NEW_FOR_YOU;
            case MOSTLY_DUPLICATES -> Headline.LIMITED_INTEREST;
            case UNKNOWN -> Headline.CONTENT_TO_CONFIRM;
            case PARTIALLY_USEFUL, HIGHLY_USEFUL -> switch (pricePosition) {
                case TOO_EXPENSIVE, RATHER_EXPENSIVE -> Headline.USEFUL_BUT_EXPENSIVE;
                case REFERENCE_UNAVAILABLE -> Headline.USEFUL_PRICE_UNKNOWN;
                default -> Headline.GOOD_FOR_YOUR_COLLECTION;
            };
        };
    }

    /**
     * True when the market reference is too weak to recommend a precise amount.
     * Proposing "offer 53 EUR" on two doubtful observations would give
     * a made-up number the authority of a calculation.
     */
    @com.fasterxml.jackson.annotation.JsonIgnore
    public boolean referenceTooWeakForAnOffer() {
        return pricePosition == PricePosition.REFERENCE_UNAVAILABLE;
    }
}
