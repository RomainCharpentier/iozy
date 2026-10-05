package com.iozycore.manga.deals;

import com.iozycore.manga.domain.MangaEdition;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import com.iozycore.core.listing.ListingPlatform;

/**
 * An <b>asking</b> price, noted once, for a {@link MangaEdition} -
 * an append-only log, never changed afterwards.
 *
 * <h2>What it is, and what it is not</h2>
 * A price shown by a seller on a date. <b>Not</b> a completed sale, not
 * a proof of value, not an estimate. IozyCore has no access to any transaction
 * data, and the interface reminds people of it wherever these numbers
 * appear. Two things therefore never enter it: an AI estimate
 * ({@link PriceBasis#AI_ESTIMATED}) and a catalogue new price - the first is
 * a guess, the second describes another market.
 *
 * <h2>Without fees, always</h2>
 * {@code observedPrice} is the price of the item alone. Buyer protection and
 * shipping belong to the buyer's acquisition cost, not to what the
 * product is worth: including them here would compare listings without fees to
 * totals with fees (see {@code PriceSemanticsTest}).
 *
 * <h2>Two origins, one nature</h2>
 * Manual entry or a listing really analysed: in both cases it is a
 * price seen by the user. {@link MarketObservationOrigin} tells them apart so
 * that we know where a surprising number comes from, without making it a hierarchy.
 *
 * @param scope           nullable - null means the observation covers the whole edition rather
 *                        than a precise range
 * @param volumeCount     number of volumes really concerned, when known. Takes precedence
 *                        over {@code scope}: a lot 1-4 + 7-10 counts 8 volumes, where the range
 *                        1-10 would say 10. Null for observations older than this field.
 * @param listingIdentity identity of the original listing (see {@link ListingIdentity}), or null
 *                        when there is none - a manual entry, typically. Several
 *                        observations with the SAME identity describe a single offer over time, not
 *                        several sellers.
 * @param sourceUrl       link of the original listing, to be able to go back to it. Never used
 *                        as identity directly: it is {@code listingIdentity} that is.
 */
public record MarketPriceObservation(UUID id, UUID mangaEditionId, VolumeRange scope, BigDecimal observedPrice,
                                      ListingPlatform platform, Condition observedCondition, LocalDate observedAt,
                                      String note, Instant createdAt, MarketObservationOrigin origin,
                                      Integer volumeCount, String listingIdentity, String sourceUrl) {
    public MarketPriceObservation {
        if (mangaEditionId == null) {
            throw new IllegalArgumentException("Un prix relevé doit se rattacher à une édition");
        }
        if (observedPrice == null || observedPrice.signum() < 0) {
            throw new IllegalArgumentException("Le prix relevé doit être nul ou positif");
        }
        if (observedAt == null) {
            throw new IllegalArgumentException("Un prix relevé doit porter une date");
        }
        // Observations older than this field: entered by hand, since that was the
        // only possible path. We say so rather than leave a hole.
        origin = origin == null ? MarketObservationOrigin.MANUAL_ENTRY : origin;
        if (volumeCount != null && volumeCount <= 0) {
            throw new IllegalArgumentException("Un nombre de tomes relevé doit être positif");
        }
    }

    /** The manual path, unchanged: a price seen, noted from the page of an edition. */
    public static MarketPriceObservation record_(UUID mangaEditionId, VolumeRange scope, BigDecimal observedPrice,
                                                   ListingPlatform platform, Condition observedCondition,
                                                   LocalDate observedAt, String note) {
        return new MarketPriceObservation(UUID.randomUUID(), mangaEditionId, scope, observedPrice, platform,
                observedCondition, observedAt, note, Instant.now(), MarketObservationOrigin.MANUAL_ENTRY,
                scope == null ? null : scope.expand().size(), null, null);
    }

    /**
     * The price of a listing really analysed by the user.
     *
     * @param askingPrice the price of the listing, <b>without fees</b> - never the acquisition cost
     * @param volumeCount the volumes of the lot, counted on their real list and not on a range
     */
    public static MarketPriceObservation fromAnalyzedListing(UUID mangaEditionId, VolumeRange scope, int volumeCount,
                                                              BigDecimal askingPrice, ListingPlatform platform,
                                                              Condition observedCondition, LocalDate observedAt,
                                                              String listingIdentity, String sourceUrl) {
        return new MarketPriceObservation(UUID.randomUUID(), mangaEditionId, scope, askingPrice, platform,
                observedCondition, observedAt, null, Instant.now(), MarketObservationOrigin.LISTING_ANALYSIS,
                volumeCount, listingIdentity, sourceUrl);
    }

    /**
     * What counts as <b>one</b> comparable. Two observations with the same key
     * describe the same offer followed over time; two distinct keys, two
     * offers.
     * <p>
     * Without an identity - a manual entry - each observation is its own key:
     * a user who notes two prices notes two things seen, and nothing allows
     * or justifies merging them.
     */
    @com.fasterxml.jackson.annotation.JsonIgnore
    public String comparableKey() {
        return listingIdentity != null ? listingIdentity : "observation:" + id;
    }
}
