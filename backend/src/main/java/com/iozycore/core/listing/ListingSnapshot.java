package com.iozycore.core.listing;

import com.iozycore.core.listing.ListingPlatform;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

/**
 * What IozyCore has really been able to read from an online listing, at a given
 * moment, in a form independent of the original platform.
 * <p>
 * <b>Everything is optional except the source and the URL.</b> A listing of which only the
 * title and price are readable produces a snapshot with these two fields and
 * nothing else - never a failure, never a value invented to fill a
 * gap. {@link #retrievedFields()} says exactly what was found, which
 * lets the client pre-fill only that, and the user know what
 * is left to type.
 * <p>
 * <b>It is a photograph, not a live link.</b> {@code retrievedAt} dates
 * the reading; if the seller changes their price afterwards, this snapshot does not move
 * and neither does the analysis that relies on it. No synchronization exists.
 * <p>
 * Deliberately without personal data of the seller: nickname, avatar,
 * precise location bring nothing to the purchase verdict and so do not have to
 * be retrieved or kept.
 *
 * @param externalId identifier of the listing at the source, when it is readable - used to recognize two URLs of the same listing
 * @param price              displayed price, excluding fees - the analysis form keeps them separate
 * @param shippingFee        shipping amount read, or null if it is unreadable
 * @param shippingKind       what this amount is really worth - free, firm, or just a floor
 *                           when several shipping modes exist. Without it, "2.83 EUR" and
 *                           "from 2.83 EUR" would become indistinguishable. A snapshot never
 *                           carries {@link ShippingEstimateKind#ESTIMATED}: that one qualifies
 *                           a user entry, not a reading of a source.
 * @param buyerProtectionFee buyer protection fee, amount really charged (after any
 *                           discount), not the price displayed before the promotion
 * @param imageUrls  photos of the listing itself, in display order - never the avatars or the thumbnails of similar items
 */
public record ListingSnapshot(ListingPlatform source, String sourceUrl, String externalId, String title,
                               String description, BigDecimal price, String currency,
                               BigDecimal shippingFee, ShippingEstimateKind shippingKind,
                               BigDecimal buyerProtectionFee,
                               List<String> imageUrls, Instant retrievedAt, List<ListingField> retrievedFields) {

    public ListingSnapshot {
        // Never an implicit zero: an unreadable shipping stays unknown,
        // assuming it is free would understate the acquisition cost.
        shippingKind = shippingKind == null ? ShippingEstimateKind.UNKNOWN : shippingKind;
        imageUrls = imageUrls == null ? List.of() : List.copyOf(imageUrls);
        retrievedFields = retrievedFields == null ? List.of() : List.copyOf(retrievedFields);
    }

    /** The fields a provider can report - used to say what was found, not what exists. */
    public enum ListingField {
        TITLE,
        DESCRIPTION,
        PRICE,
        /** Shipping fee - see the "from" reservation on {@link ListingSnapshot#shippingFee()}. */
        SHIPPING_FEE,
        BUYER_PROTECTION_FEE,
        IMAGES
    }

    /** Nothing readable: no title, no price, no description, no photo. The manual flow takes over again. */
    public boolean isEmpty() {
        return retrievedFields.isEmpty();
    }
}
