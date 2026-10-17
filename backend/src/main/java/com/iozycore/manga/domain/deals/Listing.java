package com.iozycore.manga.domain.deals;

import com.iozycore.core.listing.ShippingEstimateKind;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import com.iozycore.core.listing.ListingPlatform;

/**
 * A second-hand listing as entered by the user (URL and/or manual fields -
 * there is no automated URL scraping, see {@link PriceBasis} and the
 * data-source limitations documented on {@link PurchaseAnalysisEngine}).
 *
 * @param description                 text of the listing, as shown at the time of the analysis - read by
 *                                    {@link ListingTrustAssessment} to find the points to check,
 *                                    and by {@link ListingTextParser} to guess the content of the lot.
 *                                    Nullable: a listing may have none.
 * @param photoUrls                   EXTERNAL references to the photos of the source, frozen at the time
 *                                    of the analysis. They are not copies: the platform can let them
 *                                    expire, and IozyCore keeps no archive of them.
 * @param conditionAppliesToContainer true when {@link #condition()} describes a box/slipcase
 *                                    (e.g. a collector coffret) rather than a single standard
 *                                    volume - weighted more heavily by {@link VerdictScorer}
 */
public record Listing(UUID id, ListingPlatform platform, String url, String rawTitle, String description,
                       BigDecimal askingPrice, BigDecimal shippingFee, ShippingEstimateKind shippingKind,
                       BigDecimal buyerProtectionFee,
                       Condition condition, boolean conditionAppliesToContainer,
                       List<ListingItem> items, List<String> photoUrls, Instant requestedAt) {
    public Listing {
        if (askingPrice == null || askingPrice.signum() < 0) {
            throw new IllegalArgumentException("Le prix demandé doit être nul ou positif");
        }
        if (items == null || items.isEmpty()) {
            throw new IllegalArgumentException("Une annonce doit contenir au moins un lot");
        }
        // The KIND is never assumed, and this is where it is normalised -
        // one place for all callers: API, engine, and JSONB re-reading of an
        // old analysis.
        //
        // Kind missing but amount present: nobody said this price was
        // firm, so ESTIMATED. Giving EXACT would give a received number
        // the value of a confirmed price.
        //
        // A ZERO without a kind says nothing, however: it cannot be told apart
        // from an empty field. Reading it as "0,00 EUR estimated" would claim that a
        // free shipping was confirmed when nobody said so -
        // a really free shipping comes with FREE. This case mostly concerns
        // re-reading analyses older than this kind, where
        // shipping was zero by default.
        if (shippingKind == null) {
            shippingKind = (shippingFee == null || shippingFee.signum() == 0)
                    ? ShippingEstimateKind.UNKNOWN
                    : ShippingEstimateKind.ESTIMATED;
        }
        // UNKNOWN carrying an amount is a contradiction: the total
        // would include it while the screen says "not given".
        // The amount exists, it is just not guaranteed - this is
        // exactly ESTIMATED. This rule also repairs, on re-reading, the
        // analyses saved before this case had a name.
        if (shippingKind == ShippingEstimateKind.UNKNOWN && shippingFee != null
                && shippingFee.signum() != 0) {
            shippingKind = ShippingEstimateKind.ESTIMATED;
        }
        // The default zero stays, otherwise the total could not be computed; but
        // under UNKNOWN it is a calculation zero, not a free shipping, and
        // acquisitionCostIncludesShipping() prevents reading it any other way.
        shippingFee = shippingFee == null ? BigDecimal.ZERO : shippingFee;
        buyerProtectionFee = buyerProtectionFee == null ? BigDecimal.ZERO : buyerProtectionFee;
        items = List.copyOf(items);
        photoUrls = photoUrls == null ? List.of() : List.copyOf(photoUrls);
    }

    /**
     * What the purchase will cost: item + protection + shipping.
     * <p>
     * <b>This is an ESTIMATED acquisition cost, not an invoiced amount.</b> Two
     * reservations can affect it, and the interface must show them:
     * <ul>
     *   <li>shipping "from" a price: the total is a <b>minimum</b>
     *       ({@link #acquisitionCostIsLowerBound()});</li>
     *   <li>unknown shipping: the total is <b>incomplete</b>, it contains
     *       no shipping ({@link #acquisitionCostIncludesShipping()}) and must not
     *       be announced as an acquisition cost.</li>
     * </ul>
     * The historical name of this field in the analyses already saved is
     * {@code totalRealCost}; its meaning is the one above.
     * <p>
     * Never confuse it with {@link #askingPrice()}: it is the price of the
     * item alone that is compared to the prices of other listings, which are
     * also without fees. Comparing a total with fees to prices without
     * fees would compare two different quantities.
     */
    public BigDecimal totalRealCost() {
        return askingPrice.add(buyerProtectionFee).add(shippingFee);
    }

    /** True when the acquisition cost is only a minimum, the shipping being a "from" price. */
    @com.fasterxml.jackson.annotation.JsonIgnore
    public boolean acquisitionCostIsLowerBound() {
        return shippingKind.isLowerBound();
    }

    /**
     * True when a shipping could be taken into account - free, firm,
     * minimum or estimated. False under {@link ShippingEstimateKind#UNKNOWN}: the
     * total is then only a <b>known subtotal</b>, and announcing it as an
     * acquisition cost would suggest a purchase at 11,20 EUR that will cost
     * more.
     */
    @com.fasterxml.jackson.annotation.JsonIgnore
    public boolean acquisitionCostIncludesShipping() {
        return shippingKind.hasAmount();
    }
}
