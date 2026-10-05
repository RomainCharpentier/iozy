package com.iozycore.manga.deals;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;

/**
 * What this listing brings <b>to this collection</b>.
 *
 * <h2>The question nobody else can ask</h2>
 * Any comparison tool can say "this lot is 18 % under the median". None can
 * say "you already own four of them". Yet this second number is the one that
 * decides: a lot of 14 volumes at 70 EUR with 4 duplicates does not cost
 * 5 EUR a volume, it costs <b>7 EUR per volume that is useful to you</b>.
 * The first number flatters the deal, the second one judges it.
 *
 * <h2>Three states, not two</h2>
 * An item is owned, missing, or wished. "Wished" is not a shade of "missing":
 * it is an intention already stated
 * (<i>Wishlist ≠ Ownership</i>, an invariant of the model), and a lot that
 * overlaps the wishes is worth more than a lot that simply overlaps gaps.
 *
 * <h2>Pure domain</h2>
 * Built from numbers already computed by the per-series analysis. No database,
 * network or Spring access: the rule "what is useful to me" can be tested as it
 * is, and it works as well for a Vinted listing as for a listing typed by hand.
 */
public record CollectionFit(int detectedItemCount, int ownedItemCount, int missingItemCount,
                             int wishlistedItemCount, int usefulItemCount,
                             BigDecimal pricePerItem, BigDecimal pricePerUsefulItem,
                             CollectionInterest interest) {

    /**
     * What the lot means for this collection. Named rather than scored:
     * "62/100" cannot be discussed, "half of the lot is duplicates" can.
     */
    public enum CollectionInterest {
        /** Everything is already owned - the lot brings nothing, whatever its price. */
        NOTHING_NEW,
        /** Mostly duplicates. */
        MOSTLY_DUPLICATES,
        /** A real contribution, mixed with duplicates. */
        PARTIALLY_USEFUL,
        /** Almost everything is missing. */
        HIGHLY_USEFUL,
        /** No item could be identified: nothing to say, and above all nothing to make up. */
        UNKNOWN
    }

    /** Above this share of useful items, the lot is a real contribution. */
    private static final double SEUIL_TRES_UTILE = 0.8;
    /** Below it, the lot mostly serves to buy again what we already have. */
    private static final double SEUIL_SURTOUT_DOUBLONS = 0.4;

    /** Nothing was identified: the rest of the analysis goes on, this dimension stays silent. */
    public static CollectionFit unknown() {
        return new CollectionFit(0, 0, 0, 0, 0, null, null, CollectionInterest.UNKNOWN);
    }

    /**
     * @param totalCost real total cost of the lot (price + fees), or {@code null} if it cannot be computed
     * @param wishlisted items of the lot already in the wishes - a subset of the missing ones
     */
    public static CollectionFit of(int detected, int owned, int wishlisted, BigDecimal totalCost) {
        if (detected <= 0) {
            return unknown();
        }
        int manquants = Math.max(0, detected - owned);
        // An item already owned is not useful: we never assume that a
        // second copy is welcome. If the model one day expresses a wish
        // for a duplicate, the rule will change HERE, in one place.
        int utiles = manquants;

        BigDecimal parElement = diviser(totalCost, detected);
        BigDecimal parElementUtile = utiles > 0 ? diviser(totalCost, utiles) : null;

        return new CollectionFit(detected, owned, manquants, Math.min(wishlisted, manquants), utiles,
                parElement, parElementUtile, interet(detected, utiles));
    }

    private static BigDecimal diviser(BigDecimal total, int parts) {
        if (total == null || parts <= 0 || total.signum() < 0) {
            return null;
        }
        return total.divide(BigDecimal.valueOf(parts), 2, RoundingMode.HALF_UP);
    }

    private static CollectionInterest interet(int detected, int utiles) {
        if (utiles == 0) {
            return CollectionInterest.NOTHING_NEW;
        }
        double part = (double) utiles / detected;
        if (part >= SEUIL_TRES_UTILE) {
            return CollectionInterest.HIGHLY_USEFUL;
        }
        return part < SEUIL_SURTOUT_DOUBLONS
                ? CollectionInterest.MOSTLY_DUPLICATES
                : CollectionInterest.PARTIALLY_USEFUL;
    }

    /** Adds up the per-series analyses already produced - a single source of truth for duplicates. */
    public static CollectionFit fromItemBreakdown(List<ItemAnalysis> items, int wishlisted, BigDecimal totalCost) {
        if (items == null || items.isEmpty()) {
            return unknown();
        }
        int detected = 0;
        int owned = 0;
        for (ItemAnalysis item : items) {
            detected += item.item().includedVolumes().size();
            owned += item.duplicates() == null ? 0 : item.duplicates().duplicateVolumeNumbers().size();
        }
        return of(detected, owned, wishlisted, totalCost);
    }

    // @JsonIgnore: derived helpers, not fields. Without it, the getter
    // auto-detection serializes them as extra properties that match no
    // component, and reading the JSONB payload back breaks
    // (same trap as CollectionStatus).
    @com.fasterxml.jackson.annotation.JsonIgnore
    public boolean isKnown() {
        return interest != CollectionInterest.UNKNOWN;
    }

    /** True when the lot brings nothing: the price per useful item then does not exist, and must not be shown. */
    @com.fasterxml.jackson.annotation.JsonIgnore
    public boolean bringsNothing() {
        return interest == CollectionInterest.NOTHING_NEW;
    }
}
