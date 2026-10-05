package com.iozycore.manga.deals;

import com.iozycore.manga.domain.MangaEdition;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Decides whether two offers are <b>the same product</b>, before comparing their
 * prices.
 *
 * <h2>The flaw that this class removes</h2>
 * Until now, every observation linked to the edition entered the median, reduced
 * to a price per volume. On <i>Platinum End</i>, a single volume at 8 EUR, a lot 1-4 at 20 EUR
 * and a lot 7-10 at 18 EUR gave 8,00 / 5,00 / 4,50 EUR per volume, median 5,00 EUR,
 * and three observations were enough to get HIGH confidence. A listing 1-14
 * therefore inherited a reference of 70 EUR presented as solid, while none
 * of the three observations describes what a lot of 14 volumes is.
 *
 * <h2>The rules, in order</h2>
 * <ol>
 *   <li><b>Same edition.</b> Already guaranteed upstream: an observation is linked to
 *       a {@link MangaEdition}, which carries the series AND the edition. A
 *       Perfect Edition is not compared with a Standard one.</li>
 *   <li><b>Same shape</b> ({@link LotShape}): single volume with single volume, partial
 *       lot with partial lot, complete set with complete set.</li>
 *   <li><b>Comparable size</b> for partial lots: the number of volumes does not
 *       vary by more than double. A lot of 10 informs a lot of
 *       14; a lot of 4 does not.</li>
 *   <li><b>Freshness</b>: beyond {@value #ANCIENNETE_MAX_MOIS} months, an
 *       observation describes another market and is dropped.</li>
 *   <li><b>One listing, one comparable</b>: the observations coming from the same
 *       listing are grouped, and only the most recent is kept. Three
 *       analyses of the same URL are not three sellers.</li>
 *   <li><b>The listing being assessed is excluded</b>: an offer is not
 *       compared with itself.</li>
 * </ol>
 *
 * <h2>What is deliberately not a rule</h2>
 * The <b>condition</b> ({@link Condition}) drops no comparable. It is a
 * price modifier, not a difference of product, and filtering on it
 * would empty samples that are already small. The resulting spread is
 * measured and lowers the confidence - the reservation is stated rather than the
 * observation thrown away. Neither is the <b>platform</b>: the gaps between Vinted and
 * Leboncoin are real but poorly documented here, and making them up would be worse.
 *
 * <h2>Pure domain</h2>
 * No database, network or Spring access. Today's date is a parameter, not a
 * hidden call: this is what makes the freshness rule testable.
 */
public final class MarketComparableSelector {

    private MarketComparableSelector() {
    }

    /** Beyond this, the observation describes a market that is gone. */
    static final int ANCIENNETE_MAX_MOIS = 24;

    /** Below this, the observation is considered current; beyond, the confidence drops by one level. */
    static final int FRAICHEUR_MOIS = 12;

    /**
     * Maximum size ratio between two comparable partial lots. 2 means
     * "up to double": beyond, it is no longer the same product.
     */
    static final int RAPPORT_TAILLE_MAX = 2;

    /**
     * The observations kept, and - if there are none - the exact reason.
     *
     * @param examined number of observations examined: saying "3 observations exist, none comparable"
     *                 is better than "no data", which would be false
     */
    /**
     * @param retained      one observation per listing - these are the INDEPENDENT comparables
     * @param examined      observations examined before filtering
     * @param temporalCount comparable observations before grouping by listing: five observations
     *                      of the same offer followed over time still make one comparable
     */
    public record Selection(List<MarketPriceObservation> retained, int examined, int temporalCount,
                            ReferenceGap gap) {
        public Selection {
            retained = retained == null ? List.of() : List.copyOf(retained);
        }

        public boolean isEmpty() {
            return retained.isEmpty();
        }
    }

    /**
     * @param edition           the target edition, {@code null} if it is not in the catalogue
     * @param targetVolumeCount number of volumes of the listing being assessed
     * @param candidates        all the observations known for this edition
     * @param today             the reference date for freshness - a parameter, never {@code LocalDate.now()} here
     */
    public static Selection selectFor(MangaEdition edition, int targetVolumeCount,
                                       List<MarketPriceObservation> candidates, LocalDate today) {
        return selectFor(edition, targetVolumeCount, candidates, today, null);
    }

    /**
     * @param currentListing identity of the listing being assessed, excluded from its own
     *                       comparables; {@code null} when no precise listing is assessed
     */
    public static Selection selectFor(MangaEdition edition, int targetVolumeCount,
                                       List<MarketPriceObservation> candidates, LocalDate today,
                                       String currentListing) {
        if (edition == null) {
            return new Selection(List.of(), 0, 0, ReferenceGap.EDITION_NOT_IN_CATALOGUE);
        }
        if (candidates == null || candidates.isEmpty()) {
            return new Selection(List.of(), 0, 0, ReferenceGap.NO_OBSERVATION);
        }

        LotShape formeCible = LotShape.of(targetVolumeCount, edition.totalVolumes());
        if (!formeCible.isComparable()) {
            return new Selection(List.of(), candidates.size(), 0, ReferenceGap.NO_COMPARABLE_SHAPE);
        }

        List<MarketPriceObservation> memeProduit = new ArrayList<>();
        boolean ecarteUniquementParAge = false;
        boolean seuleLAnnonceCourante = false;

        for (MarketPriceObservation observation : candidates) {
            // A listing is not compared with itself. The case happens as soon as
            // a URL that was already analysed is analysed again: without this exclusion, the
            // reference would equal the asking price, and any listing would then
            // say it is "at market price" - its own.
            if (currentListing != null && currentListing.equals(observation.listingIdentity())) {
                seuleLAnnonceCourante = true;
                continue;
            }
            int tomes = nombreDeTomes(observation, edition);
            LotShape forme = LotShape.of(tomes, edition.totalVolumes());
            if (forme != formeCible || !tailleCompatible(formeCible, tomes, targetVolumeCount)) {
                continue;
            }
            // The shape matches: if only the age disqualifies it, we will be able to
            // say so precisely rather than conclude "no comparable".
            if (tropAncien(observation, today)) {
                ecarteUniquementParAge = true;
                continue;
            }
            memeProduit.add(observation);
        }

        if (memeProduit.isEmpty()) {
            // Name the RIGHT absence. "No comparable lot" would send people to note
            // one more price on a listing that was already noted; what
            // is missing here is ANOTHER offer.
            return new Selection(List.of(), candidates.size(), 0, manqueA(ecarteUniquementParAge, seuleLAnnonceCourante));
        }
        return new Selection(unParAnnonce(memeProduit), candidates.size(), memeProduit.size(), ReferenceGap.NONE);
    }

    /**
     * The most precise absence that the selection allows us to state. The order
     * matters: if the current listing was dropped, it is the explanation closest
     * to what the user sees.
     */
    private static ReferenceGap manqueA(boolean ecarteParAge, boolean seuleLAnnonceCourante) {
        if (seuleLAnnonceCourante) {
            return ReferenceGap.ONLY_CURRENT_LISTING;
        }
        return ecarteParAge ? ReferenceGap.ONLY_STALE_OBSERVATIONS : ReferenceGap.NO_COMPARABLE_SHAPE;
    }

    /**
     * Reduces the observations to <b>one per listing</b>, keeping the most recent.
     *
     * <h2>The trap that it removes</h2>
     * The same listing followed over time produces several observations: this is
     * useful price information, and it stays in the database. But a sample
     * counts <b>independent offers</b>, not rows. Without this
     * grouping, analysing the same URL five times would be enough to get
     * HIGH confidence on a single seller - a precise number taken from a single
     * observation of the market.
     * <p>
     * The most recent wins because it describes the current state of this offer:
     * a listing that went from 70 to 60 EUR is worth 60 EUR today. With an equal date,
     * the observation saved last decides.
     */
    private static List<MarketPriceObservation> unParAnnonce(List<MarketPriceObservation> observations) {
        Map<String, MarketPriceObservation> parAnnonce = new LinkedHashMap<>();
        for (MarketPriceObservation observation : observations) {
            parAnnonce.merge(observation.comparableKey(), observation,
                    (existant, candidat) -> PLUS_RECENT.compare(candidat, existant) > 0 ? candidat : existant);
        }
        return List.copyOf(parAnnonce.values());
    }

    /** The observation that best describes the current state of an offer. */
    private static final Comparator<MarketPriceObservation> PLUS_RECENT =
            Comparator.comparing(MarketPriceObservation::observedAt)
                    .thenComparing(MarketPriceObservation::createdAt);

    /**
     * An observation without a scope covers the whole edition: its number of volumes is
     * that of the edition. If unknown, it is 0 and will be classed
     * {@link LotShape#INDETERMINATE} - never guessed.
     */
    static int nombreDeTomes(MarketPriceObservation observation, MangaEdition edition) {
        if (observation.scope() != null) {
            return observation.scope().expand().size();
        }
        Integer total = edition.totalVolumes();
        return total != null && total > 0 ? total : 0;
    }

    /**
     * Only partial lots need this check: a single volume
     * is always one volume, and two complete sets of the same edition have the same
     * number of volumes.
     */
    private static boolean tailleCompatible(LotShape forme, int tomes, int cible) {
        if (forme != LotShape.PARTIAL_LOT) {
            return true;
        }
        int petit = Math.min(tomes, cible);
        int grand = Math.max(tomes, cible);
        return (long) petit * RAPPORT_TAILLE_MAX >= grand;
    }

    private static boolean tropAncien(MarketPriceObservation observation, LocalDate today) {
        return observation.observedAt().isBefore(today.minusMonths(ANCIENNETE_MAX_MOIS));
    }

    /** True when the most recent of the observations kept is past the freshness window. */
    static boolean toutEstAncien(List<MarketPriceObservation> retenus, LocalDate today) {
        LocalDate limite = today.minusMonths(FRAICHEUR_MOIS);
        return retenus.stream().noneMatch(observation -> !observation.observedAt().isBefore(limite));
    }
}
