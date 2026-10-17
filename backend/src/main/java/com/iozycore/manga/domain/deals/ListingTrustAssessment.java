package com.iozycore.manga.domain.deals;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.regex.Pattern;

/**
 * The points to check on a listing, and nothing else.
 *
 * <h2>A separate dimension, on purpose</h2>
 * "Is this price good?" and "is this listing clean?" are two different
 * questions, and merging them into one number loses both.
 * A lot sold cheap by someone who is moving and a lot sold cheap that will never arrive
 * have the same price; what tells them apart is in the details that this
 * class picks up. It therefore never influences the price assessment, and
 * the other way round.
 *
 * <h2>What it does not look at</h2>
 * Nothing about the seller - no rating, no seniority, no number of sales. This
 * data exists at Vinted, but only behind an authenticated session:
 * IozyCore does not fetch it (see docs/LISTING_SOURCES.md).
 * A listing entered by hand has none anyway, and the assessment must
 * work there too.
 *
 * <h2>Pure domain</h2>
 * No network, database or Spring access: text, a number of photos, a price
 * and a reference. Testable as it is.
 */
public record ListingTrustAssessment(TrustLevel level, List<TrustSignal> signals) {

    /** Below this, a description says nothing about what we are buying. */
    private static final int LONGUEUR_DESCRIPTION_MINIMALE = 40;

    /** A lot shown from two angles at most leaves too many gray areas. */
    private static final int PHOTOS_INSUFFISANTES = 2;

    /**
     * Below this fraction of the reference, the gap deserves a look
     * at why. A <b>vigilance</b> threshold, not a rejection: the price
     * is still assessed as a good deal (see {@link PricePosition}).
     */
    private static final BigDecimal SEUIL_PRIX_TRES_BAS = new BigDecimal("0.40");

    /**
     * Mentions of payment or contact outside the platform. An explicit and
     * testable list rather than a model: these wordings are stable, and a
     * detection that can be read is a detection that can be corrected.
     */
    private static final Pattern HORS_PLATEFORME = Pattern.compile(
            "\\b(?:paypal|payp[ao]l|virement|whatsapp|whats app|telegram|snapchat|"
                    + "paiement (?:en )?(?:direct|dehors|hors)|hors vinted|en dehors de vinted|"
                    + "main ?propre uniquement|contacte[- ]moi (?:au|sur)|mon num[ée]ro|par sms)\\b",
            Pattern.CASE_INSENSITIVE);

    public ListingTrustAssessment {
        signals = signals == null ? List.of() : List.copyOf(signals);
    }

    /**
     * Examines what is really available.
     *
     * @param description    text of the listing, possibly missing
     * @param photoCount     number of photos really retrieved
     * @param askingPrice    asking price
     * @param referencePrice market reference, or {@code null} if none is reliable -
     *                       without it, no judgement on "abnormally low price" is possible
     */
    public static ListingTrustAssessment assess(String description, int photoCount,
                                                 BigDecimal askingPrice, BigDecimal referencePrice) {
        List<TrustSignal> signaux = new ArrayList<>();

        if (photoCount == 0) {
            signaux.add(TrustSignal.NO_PHOTO);
        } else if (photoCount <= PHOTOS_INSUFFISANTES) {
            signaux.add(TrustSignal.VERY_FEW_PHOTOS);
        }
        // Deliberately silent beyond that: many photos prove nothing, and
        // turning abundance into a sign of seriousness would be exactly the kind
        // of shortcut that a malicious seller uses.

        String texte = description == null ? "" : description.trim();
        if (texte.length() < LONGUEUR_DESCRIPTION_MINIMALE) {
            signaux.add(TrustSignal.SHORT_DESCRIPTION);
        }
        if (HORS_PLATEFORME.matcher(texte.toLowerCase(Locale.ROOT)).find()) {
            signaux.add(TrustSignal.OFF_PLATFORM_PAYMENT_MENTION);
        }

        if (referencePrice != null && referencePrice.signum() > 0 && askingPrice != null
                && askingPrice.compareTo(referencePrice.multiply(SEUIL_PRIX_TRES_BAS)) < 0) {
            signaux.add(TrustSignal.PRICE_FAR_BELOW_REFERENCE);
        }

        signaux.sort(Comparator.comparing((TrustSignal s) -> s.severity()).reversed());
        return new ListingTrustAssessment(niveau(signaux), signaux);
    }

    /**
     * The level follows from what was noted, with no hidden arithmetic: one
     * strong signal is enough to make people look closely, the accumulation of weak signals
     * counts less than a single strong signal.
     */
    private static TrustLevel niveau(List<TrustSignal> signaux) {
        if (signaux.isEmpty()) {
            return TrustLevel.NO_OBVIOUS_SIGNAL;
        }
        long forts = signaux.stream().filter(s -> s.severity() == TrustSignalSeverity.HIGH).count();
        if (forts >= 2) {
            return TrustLevel.CONCERNING;
        }
        if (forts == 1) {
            return TrustLevel.EXAMINE_CAREFULLY;
        }
        long moyens = signaux.stream().filter(s -> s.severity() == TrustSignalSeverity.MEDIUM).count();
        return moyens >= 2 ? TrustLevel.EXAMINE_CAREFULLY : TrustLevel.A_FEW_THINGS_TO_CHECK;
    }

    public boolean hasSignal(TrustSignal signal) {
        return signals.contains(signal);
    }
}
