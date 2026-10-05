package com.iozycore.manga.deals;

/**
 * A point to check before buying — <b>never a fraud verdict</b>.
 * <p>
 * The distinction is not cosmetic. IozyCore only sees the text, the price and
 * the photos of a listing: nothing in there allows us to establish an
 * intention. A very low price can be a real bargain, a short description
 * can come from a seller in a hurry. These signals therefore serve to direct
 * the eye, not to conclude - and above all, they do not enter the assessment of the
 * price, which stays a separate question.
 * <p>
 * Structured codes rather than sentences: French lives on the presentation side, which
 * allows the rules to be tested without depending on a label.
 */
public enum TrustSignal {

    /** No photo: impossible to judge the real condition of what is sold. */
    NO_PHOTO(TrustSignalSeverity.HIGH),

    /** One or two photos only for a lot: we do not see everything we buy. */
    VERY_FEW_PHOTOS(TrustSignalSeverity.MEDIUM),

    /** Description missing or reduced to a few words. */
    SHORT_DESCRIPTION(TrustSignalSeverity.LOW),

    /**
     * The text offers to pay or talk outside the platform. This is the
     * only really strong signal here: leaving the platform means losing
     * buyer protection, and it is the classic way scams work.
     */
    OFF_PLATFORM_PAYMENT_MENTION(TrustSignalSeverity.HIGH),

    /**
     * Price far below the reference. <b>A vigilance signal, not a proof of
     * fraud</b>: an excellent deal really exists. It is here to
     * call for caution, and never lowers the price assessment - which, on the contrary,
     * counts it as a good point.
     */
    PRICE_FAR_BELOW_REFERENCE(TrustSignalSeverity.MEDIUM);

    private final TrustSignalSeverity severity;

    TrustSignal(TrustSignalSeverity severity) {
        this.severity = severity;
    }

    public TrustSignalSeverity severity() {
        return severity;
    }
}
