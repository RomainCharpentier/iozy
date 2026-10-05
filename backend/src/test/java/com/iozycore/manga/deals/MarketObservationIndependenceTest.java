package com.iozycore.manga.deals;

import com.iozycore.manga.domain.EditionTier;
import com.iozycore.manga.domain.MangaEdition;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import com.iozycore.core.listing.ListingPlatform;

/**
 * <b>A sample counts sellers, not rows in the database.</b>
 *
 * <h2>The flaw these tests forbid</h2>
 * The same listing analysed five times produces five records. If each one counted,
 * reloading a page would be enough to push a reference to HIGH on
 * a single offer: a precise figure drawn from one single observation of the market,
 * exactly what confidence is supposed to prevent.
 * <p>
 * And a listing is not compared with itself: from the second analysis of a
 * URL, its own price would be in the sample, and every listing would call itself
 * "at the market price" - its own.
 */
class MarketObservationIndependenceTest {

    private static final LocalDate AUJOURD_HUI = LocalDate.of(2026, 8, 23);

    private static MangaEdition edition() {
        return MangaEdition.create("Berserk", "Standard", EditionTier.STANDARD, "Glenat",
                20, new BigDecimal("8.50"), false, false, null);
    }

    /** A record coming from a listing, with its identity and its write age. */
    private static MarketPriceObservation depuisAnnonce(MangaEdition edition, String identite, String prix,
                                                         LocalDate date, int ordreEcriture) {
        return new MarketPriceObservation(java.util.UUID.randomUUID(), edition.id(), new VolumeRange(1, 12),
                new BigDecimal(prix), ListingPlatform.VINTED, Condition.VERY_GOOD, date, null,
                Instant.parse("2026-08-01T10:00:00Z").plusSeconds(ordreEcriture), // breaks ties on equal date
                MarketObservationOrigin.LISTING_ANALYSIS, 12, identite, "https://www.vinted.fr/items/" + identite);
    }

    private static MarketReference referencePour(MangaEdition edition, List<MarketPriceObservation> releves,
                                                  String annonceCourante) {
        return MarketReference.fromComparables(edition, 14,
                MarketComparableSelector.selectFor(edition, 14, releves, AUJOURD_HUI, annonceCourante), AUJOURD_HUI);
    }

    // =============================================== B, C: a tracked listing

    @Test
    void trois_releves_de_la_meme_annonce_ne_font_qu_un_comparable() {
        MangaEdition edition = edition();
        List<MarketPriceObservation> releves = List.of(
                depuisAnnonce(edition, "VINTED:A", "70.00", AUJOURD_HUI.minusDays(6), 1),
                depuisAnnonce(edition, "VINTED:A", "65.00", AUJOURD_HUI.minusDays(3), 2),
                depuisAnnonce(edition, "VINTED:A", "60.00", AUJOURD_HUI.minusDays(1), 3));

        MarketReference reference = referencePour(edition, releves, null);

        // The history exists - three records - but it describes ONE offer.
        assertThat(reference.temporalCount()).isEqualTo(3);
        assertThat(reference.sampleSize()).isEqualTo(1);
        // And therefore never HIGH: that is the whole point.
        assertThat(reference.confidence()).isEqualTo(MarketReferenceConfidence.LOW);
        assertThat(reference.isUsable()).isFalse();
    }

    @Test
    void le_prix_retenu_pour_une_annonce_suivie_est_le_plus_recent() {
        MangaEdition edition = edition();
        // Deliberately out of order: the DATE decides, not the order.
        List<MarketPriceObservation> releves = List.of(
                depuisAnnonce(edition, "VINTED:A", "60.00", AUJOURD_HUI.minusDays(1), 3),
                depuisAnnonce(edition, "VINTED:A", "70.00", AUJOURD_HUI.minusDays(6), 1));

        MarketReference reference = referencePour(edition, releves, null);

        // 60 / 12 volumes = 5.00 a volume, x 14 target volumes = 70.00.
        // Yesterday's price describes this offer; the one from six days ago no
        // longer does.
        assertThat(reference.price()).isEqualByComparingTo("70.00");
        assertThat(reference.mostRecentObservation()).isEqualTo(AUJOURD_HUI.minusDays(1));
    }

    @Test
    void cinq_releves_d_une_seule_annonce_ne_declenchent_jamais_HIGH() {
        MangaEdition edition = edition();
        List<MarketPriceObservation> releves = List.of(
                depuisAnnonce(edition, "VINTED:A", "51.00", AUJOURD_HUI.minusDays(9), 1),
                depuisAnnonce(edition, "VINTED:A", "51.00", AUJOURD_HUI.minusDays(7), 2),
                depuisAnnonce(edition, "VINTED:A", "51.00", AUJOURD_HUI.minusDays(5), 3),
                depuisAnnonce(edition, "VINTED:A", "51.00", AUJOURD_HUI.minusDays(3), 4),
                depuisAnnonce(edition, "VINTED:A", "51.00", AUJOURD_HUI.minusDays(1), 5));

        MarketReference reference = referencePour(edition, releves, null);

        assertThat(reference.sampleSize()).isEqualTo(1);
        assertThat(reference.confidence()).isNotEqualTo(MarketReferenceConfidence.HIGH);
        assertThat(DealAssessmentPolicy.positionOf(new BigDecimal("40"), reference))
                .isEqualTo(PricePosition.REFERENCE_UNAVAILABLE);
    }

    // ================================================ D: three real listings

    @Test
    void trois_annonces_distinctes_font_trois_comparables_independants() {
        MangaEdition edition = edition();
        List<MarketPriceObservation> releves = List.of(
                depuisAnnonce(edition, "VINTED:A", "48.00", AUJOURD_HUI.minusDays(9), 1),
                depuisAnnonce(edition, "VINTED:B", "51.00", AUJOURD_HUI.minusDays(7), 2),
                depuisAnnonce(edition, "VINTED:C", "54.00", AUJOURD_HUI.minusDays(5), 3));

        MarketReference reference = referencePour(edition, releves, null);

        assertThat(reference.sampleSize()).isEqualTo(3);
        assertThat(reference.temporalCount()).isEqualTo(3);
        assertThat(reference.confidence()).isEqualTo(MarketReferenceConfidence.HIGH);
    }

    @Test
    void deux_annonces_dont_une_suivie_trois_fois_font_deux_comparables() {
        MangaEdition edition = edition();
        List<MarketPriceObservation> releves = List.of(
                depuisAnnonce(edition, "VINTED:A", "48.00", AUJOURD_HUI.minusDays(9), 1),
                depuisAnnonce(edition, "VINTED:A", "45.00", AUJOURD_HUI.minusDays(6), 2),
                depuisAnnonce(edition, "VINTED:A", "42.00", AUJOURD_HUI.minusDays(3), 3),
                depuisAnnonce(edition, "VINTED:B", "51.00", AUJOURD_HUI.minusDays(2), 4));

        MarketReference reference = referencePour(edition, releves, null);

        assertThat(reference.temporalCount()).isEqualTo(4);
        assertThat(reference.sampleSize()).isEqualTo(2);
        assertThat(reference.confidence()).isEqualTo(MarketReferenceConfidence.MEDIUM);
    }

    // ============================================ E: the current listing excluded

    @Test
    void une_annonce_ne_se_compare_jamais_a_elle_meme() {
        MangaEdition edition = edition();
        List<MarketPriceObservation> releves = List.of(
                depuisAnnonce(edition, "VINTED:A", "42.00", AUJOURD_HUI.minusDays(9), 1),
                depuisAnnonce(edition, "VINTED:B", "45.00", AUJOURD_HUI.minusDays(7), 2),
                depuisAnnonce(edition, "VINTED:C", "96.00", AUJOURD_HUI.minusDays(1), 3));

        // We re-assess C: its own price, far above, must not pull the
        // reference toward itself and make it pass for "at the market price".
        MarketReference sansSoi = referencePour(edition, releves, "VINTED:C");
        MarketReference avecSoi = referencePour(edition, releves, null);

        assertThat(sansSoi.sampleSize()).isEqualTo(2);
        // 42/12 = 3.50 and 45/12 = 3.75 -> median 3.63 x 14 = 50.82.
        assertThat(sansSoi.price()).isEqualByComparingTo("50.82");
        // With itself: 3.50 / 3.75 / 8.00 -> median 3.75 x 14 = 52.50, and
        // above all a sample inflated by an offer that is not one.
        assertThat(avecSoi.sampleSize()).isEqualTo(3);
        assertThat(avecSoi.price()).isNotEqualByComparingTo(sansSoi.price());
    }

    @Test
    void exclure_l_annonce_courante_peut_rendre_la_reference_indisponible_et_c_est_correct() {
        MangaEdition edition = edition();
        // The only comparable IS the assessed listing: nothing is left.
        List<MarketPriceObservation> releves = List.of(
                depuisAnnonce(edition, "VINTED:C", "96.00", AUJOURD_HUI.minusDays(1), 1));

        MarketReference reference = referencePour(edition, releves, "VINTED:C");

        assertThat(reference.confidence()).isEqualTo(MarketReferenceConfidence.UNAVAILABLE);
        // Better "no reference" than a reference equal to the asking price.
        assertThat(reference.price()).isNull();
        // And the absence is named for what it is: ANOTHER
        // offer is missing, not one more record on this one.
        assertThat(reference.gap()).isEqualTo(ReferenceGap.ONLY_CURRENT_LISTING);
    }

    // ========================================== J: manual records untouched

    @Test
    void deux_releves_manuels_restent_deux_comparables() {
        MangaEdition edition = edition();
        // Without a listing behind them, nothing allows - or justifies - merging them:
        // the user saw two prices and noted two.
        List<MarketPriceObservation> releves = List.of(
                MarketPriceObservation.record_(edition.id(), new VolumeRange(1, 12), new BigDecimal("48.00"),
                        ListingPlatform.VINTED, Condition.VERY_GOOD, AUJOURD_HUI.minusDays(9), null),
                MarketPriceObservation.record_(edition.id(), new VolumeRange(1, 12), new BigDecimal("54.00"),
                        ListingPlatform.LEBONCOIN, Condition.GOOD, AUJOURD_HUI.minusDays(4), null));

        MarketReference reference = referencePour(edition, releves, null);

        assertThat(reference.sampleSize()).isEqualTo(2);
        assertThat(reference.temporalCount()).isEqualTo(2);
        assertThat(releves.get(0).origin()).isEqualTo(MarketObservationOrigin.MANUAL_ENTRY);
        assertThat(releves.get(0).listingIdentity()).isNull();
    }

    @Test
    void un_releve_manuel_et_un_releve_issu_d_annonce_se_completent() {
        MangaEdition edition = edition();
        List<MarketPriceObservation> releves = List.of(
                MarketPriceObservation.record_(edition.id(), new VolumeRange(1, 12), new BigDecimal("48.00"),
                        ListingPlatform.VINTED, Condition.VERY_GOOD, AUJOURD_HUI.minusDays(9), null),
                depuisAnnonce(edition, "VINTED:B", "51.00", AUJOURD_HUI.minusDays(4), 1),
                depuisAnnonce(edition, "VINTED:C", "54.00", AUJOURD_HUI.minusDays(2), 2));

        MarketReference reference = referencePour(edition, releves, null);

        // Both origins are worth the same: they are seen prices.
        assertThat(reference.sampleSize()).isEqualTo(3);
        assertThat(reference.confidence()).isEqualTo(MarketReferenceConfidence.HIGH);
    }

    // ============================================== Identity, case by case

    @Test
    void l_identifiant_de_source_prime_sur_l_url() {
        // Two links to the same listing, one with the title slug: same id,
        // so a single offer.
        String avecSlug = ListingIdentity.of(ListingPlatform.VINTED, "6789012345",
                "https://www.vinted.fr/items/6789012345-platinum-end-1-14");
        String sansSlug = ListingIdentity.of(ListingPlatform.VINTED, "6789012345",
                "https://www.vinted.fr/items/6789012345");

        assertThat(avecSlug).isEqualTo(sansSlug).isEqualTo("VINTED:6789012345");
    }

    @Test
    void a_defaut_d_identifiant_l_url_est_normalisee() {
        String avecSuivi = ListingIdentity.of(ListingPlatform.VINTED, null,
                "https://WWW.Vinted.fr/items/6789012345-lot?referrer=catalog&position=3#photos");
        String nue = ListingIdentity.of(ListingPlatform.VINTED, null,
                "https://vinted.fr/items/6789012345-lot/");

        assertThat(avecSuivi).isEqualTo(nue).isEqualTo("VINTED:url:vinted.fr/items/6789012345-lot");
    }

    @Test
    void deux_plateformes_ne_partagent_jamais_un_identifiant() {
        assertThat(ListingIdentity.of(ListingPlatform.VINTED, "12345", null))
                .isNotEqualTo(ListingIdentity.of(ListingPlatform.LEBONCOIN, "12345", null));
    }

    @Test
    void sans_identifiant_ni_url_aucune_deduplication_n_est_possible() {
        // Accepted and documented: two manual entries are two comparables.
        assertThat(ListingIdentity.of(ListingPlatform.VINTED, null, null)).isNull();
        assertThat(ListingIdentity.of(ListingPlatform.VINTED, "  ", "   ")).isNull();
        assertThat(ListingIdentity.of(ListingPlatform.VINTED, null, "pas une url")).isNull();
    }
}
