package com.iozycore.manga.domain.deals;

import com.iozycore.manga.domain.EditionTier;
import com.iozycore.manga.domain.MangaEdition;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import com.iozycore.core.listing.ListingPlatform;

/**
 * <b>Two offers are comparable only if they are the same product.</b>
 *
 * <h2>The flaw these tests forbid</h2>
 * Every record attached to the edition went into the median, brought down to a price per
 * volume. A single odd volume sells close to new; a complete set is sold off cheap.
 * Mixing the two gives a precise figure, presented as reliable from three
 * records, and wrong.
 * <p>
 * The case named in the specification - <i>Platinum End 1-14</i> against a
 * T.1, a 1-4 batch and a 7-10 batch - is checked here twice: the selection
 * keeps nothing, and the reference that follows is UNAVAILABLE rather than a
 * false market price.
 */
class MarketReferenceTest {

    private static final LocalDate AUJOURD_HUI = LocalDate.of(2026, 8, 23);

    /**
     * An edition longer than the assessed batch: a batch of 14 is a PARTIAL
     * BATCH there. On Platinum End (14 volumes in all), 1-14 is on the contrary
     * the complete set - this is precisely the distinction these rules carry, and
     * it changes the set of comparables kept.
     */
    private static MangaEdition serieLongue() {
        return MangaEdition.create("Berserk", "Standard", EditionTier.STANDARD, "Glénat",
                20, new BigDecimal("8.50"), false, false, null);
    }

    private static MangaEdition platinumEnd(Integer totalTomes) {
        return MangaEdition.create("Platinum End", "Standard", EditionTier.STANDARD, "Kazé",
                totalTomes, new BigDecimal("6.99"), false, false, null);
    }

    private static MarketPriceObservation releve(MangaEdition edition, Integer du, Integer au, String prix) {
        return releve(edition, du, au, prix, AUJOURD_HUI.minusMonths(2));
    }

    private static MarketPriceObservation releve(MangaEdition edition, Integer du, Integer au, String prix,
                                                  LocalDate date) {
        VolumeRange portee = du == null ? null : new VolumeRange(du, au);
        return MarketPriceObservation.record_(edition.id(), portee, new BigDecimal(prix),
                ListingPlatform.VINTED, Condition.VERY_GOOD, date, null);
    }

    private static MarketReference referencePour(MangaEdition edition, int tomesCibles,
                                                  List<MarketPriceObservation> releves) {
        return MarketReference.fromComparables(edition, tomesCibles,
                MarketComparableSelector.selectFor(edition, tomesCibles, releves, AUJOURD_HUI), AUJOURD_HUI);
    }

    // ============================================ THE test: Platinum End 1-14

    @Test
    void un_lot_de_14_ne_se_compare_ni_a_un_tome_seul_ni_a_des_lots_de_4() {
        MangaEdition edition = platinumEnd(14);
        List<MarketPriceObservation> releves = List.of(
                releve(edition, 1, 1, "8.00"),    // T.1 alone     -> 8.00 / volume
                releve(edition, 1, 4, "20.00"),   // batch of 4    -> 5.00 / volume
                releve(edition, 7, 10, "18.00")); // batch of 4    -> 4.50 / volume

        MarketComparableSelector.Selection selection =
                MarketComparableSelector.selectFor(edition, 14, releves, AUJOURD_HUI);

        // T.1 leaves by FORM (single volume against batch), the two batches of 4
        // by SIZE (4 x 2 = 8 < 14, more than a simple double).
        assertThat(selection.retained()).isEmpty();
        assertThat(selection.examined()).isEqualTo(3);
        assertThat(selection.gap()).isEqualTo(ReferenceGap.NO_COMPARABLE_SHAPE);

        MarketReference reference = referencePour(edition, 14, releves);

        // The old calculation: median 5.00 / volume, HIGH because "three
        // records", so 70 EUR presented as solid. Never again.
        assertThat(reference.price()).isNull();
        assertThat(reference.confidence()).isEqualTo(MarketReferenceConfidence.UNAVAILABLE);
        assertThat(reference.isUsable()).isFalse();
        assertThat(reference.source()).isEqualTo(MarketReferenceSource.NONE);
        // We can say that records EXIST: "no data" would be false,
        // and the screen must be able to advise which record to add.
        assertThat(reference.examinedCount()).isEqualTo(3);
        assertThat(reference.gap()).isEqualTo(ReferenceGap.NO_COMPARABLE_SHAPE);
    }

    @Test
    void aucune_position_prix_ne_sort_d_une_reference_indisponible() {
        MangaEdition edition = platinumEnd(14);
        MarketReference reference = referencePour(edition, 14, List.of(
                releve(edition, 1, 1, "8.00"),
                releve(edition, 1, 4, "20.00"),
                releve(edition, 7, 10, "18.00")));

        // 60 EUR would have called itself a "good price" against the invented 70 EUR.
        assertThat(DealAssessmentPolicy.positionOf(new BigDecimal("60"), reference))
                .isEqualTo(PricePosition.REFERENCE_UNAVAILABLE);
    }

    @Test
    void des_lots_de_taille_voisine_restent_comparables_eux() {
        MangaEdition edition = serieLongue();
        // 10, 12 and 13 volumes against 14: the same product, give or take a little.
        MarketReference reference = referencePour(edition, 14, List.of(
                releve(edition, 1, 10, "40.00"),  // 4.00 / volume
                releve(edition, 1, 12, "51.00"),  // 4.25 / volume
                releve(edition, 2, 14, "58.50"))); // 4.50 / volume

        assertThat(reference.sampleSize()).isEqualTo(3);
        assertThat(reference.comparedShape()).isEqualTo(LotShape.PARTIAL_LOT);
        // Median 4.25 / volume x 14 volumes.
        assertThat(reference.price()).isEqualByComparingTo("59.50");
        assertThat(reference.confidence()).isEqualTo(MarketReferenceConfidence.HIGH);
        assertThat(reference.source()).isEqualTo(MarketReferenceSource.OBSERVED_COMPARABLES);
        // Low dispersion: 0.50 of range on a median of 4.25 = 12 %.
        assertThat(reference.spreadPercent()).isEqualTo(12);
    }

    // ================================================ The shapes, one by one

    @Test
    void un_tome_seul_ne_se_compare_qu_a_des_tomes_seuls() {
        MangaEdition edition = platinumEnd(14);
        MarketReference reference = referencePour(edition, 1, List.of(
                releve(edition, 3, 3, "7.00"),
                releve(edition, 9, 9, "8.00"),
                releve(edition, 1, 10, "40.00")));  // discarded: it is not a single volume

        assertThat(reference.sampleSize()).isEqualTo(2);
        assertThat(reference.comparedShape()).isEqualTo(LotShape.SINGLE_VOLUME);
        assertThat(reference.price()).isEqualByComparingTo("7.50");
        // The batch of 10 would have pulled the reference to 4.00 EUR a volume, 47 %
        // too low for an odd volume.
        assertThat(reference.confidence()).isEqualTo(MarketReferenceConfidence.MEDIUM);
    }

    @Test
    void une_integrale_ne_se_compare_qu_a_des_integrales() {
        MangaEdition edition = platinumEnd(14);
        MarketReference reference = referencePour(edition, 14, List.of(
                releve(edition, 1, 14, "56.00"),
                releve(edition, null, null, "60.00"),  // record "on the whole edition"
                releve(edition, 1, 12, "51.00")));     // partial batch: discarded

        assertThat(reference.sampleSize()).isEqualTo(2);
        assertThat(reference.comparedShape()).isEqualTo(LotShape.COMPLETE_SET);
        // 56/14 = 4.00 and 60/14 = 4.29 a volume; median 4.15 x 14.
        assertThat(reference.price()).isEqualByComparingTo("58.10");
    }

    @Test
    void une_edition_dont_on_ignore_le_nombre_de_tomes_plafonne_la_confiance() {
        // Without a total, impossible to say that a batch of 14 is not the complete set:
        // the comparables stay usable, the certainty does not.
        MangaEdition edition = platinumEnd(null);
        MarketReference reference = referencePour(edition, 14, List.of(
                releve(edition, 1, 10, "40.00"),
                releve(edition, 1, 12, "51.00"),
                releve(edition, 2, 14, "58.50")));

        assertThat(reference.sampleSize()).isEqualTo(3);
        assertThat(reference.confidence()).isEqualTo(MarketReferenceConfidence.MEDIUM);
    }

    @Test
    void un_releve_sur_l_edition_entiere_est_inexploitable_si_l_edition_n_a_pas_de_total() {
        MangaEdition edition = platinumEnd(null);
        MarketReference reference = referencePour(edition, 14, List.of(
                releve(edition, null, null, "60.00")));

        // How many volumes are these 60 EUR worth? We do not know, so we do not divide.
        assertThat(reference.confidence()).isEqualTo(MarketReferenceConfidence.UNAVAILABLE);
        assertThat(reference.gap()).isEqualTo(ReferenceGap.NO_COMPARABLE_SHAPE);
    }

    // ============================================ Sample, age, dispersion

    @Test
    void un_seul_comparable_ne_suffit_jamais_a_positionner_un_prix() {
        MangaEdition edition = serieLongue();
        MarketReference reference = referencePour(edition, 14, List.of(releve(edition, 1, 12, "51.00")));

        assertThat(reference.sampleSize()).isEqualTo(1);
        assertThat(reference.confidence()).isEqualTo(MarketReferenceConfidence.LOW);
        assertThat(reference.isUsable()).isFalse();
        // The price exists, it is simply not reliable enough to decide.
        assertThat(reference.price()).isEqualByComparingTo("59.50");
        assertThat(DealAssessmentPolicy.positionOf(new BigDecimal("40"), reference))
                .isEqualTo(PricePosition.REFERENCE_UNAVAILABLE);
    }

    @Test
    void des_comparables_qui_se_contredisent_font_baisser_la_confiance() {
        MangaEdition edition = serieLongue();
        MarketReference reference = referencePour(edition, 14, List.of(
                releve(edition, 1, 12, "24.00"),   // 2.00 / volume
                releve(edition, 1, 12, "51.00"),   // 4.25 / volume
                releve(edition, 1, 12, "84.00"))); // 7.00 / volume

        // Three comparables of identical shape and size, but from simple to
        // triple: the median no longer describes anything stable.
        assertThat(reference.sampleSize()).isEqualTo(3);
        assertThat(reference.spreadPercent()).isEqualTo(118);
        assertThat(reference.confidence()).isEqualTo(MarketReferenceConfidence.MEDIUM);
    }

    @Test
    void un_releve_de_plus_de_deux_ans_ne_decrit_plus_le_marche() {
        MangaEdition edition = serieLongue();
        List<MarketPriceObservation> releves = List.of(
                releve(edition, 1, 12, "51.00", AUJOURD_HUI.minusMonths(30)),
                releve(edition, 1, 12, "48.00", AUJOURD_HUI.minusMonths(40)));

        MarketReference reference = referencePour(edition, 14, releves);

        assertThat(reference.confidence()).isEqualTo(MarketReferenceConfidence.UNAVAILABLE);
        // The reason is precise: they are not bad comparables, they are
        // old comparables. The screen can say so, and the user can act.
        assertThat(reference.gap()).isEqualTo(ReferenceGap.ONLY_STALE_OBSERVATIONS);
    }

    @Test
    void des_comparables_tous_vieux_d_un_an_gardent_leur_prix_mais_perdent_un_cran() {
        MangaEdition edition = serieLongue();
        MarketReference reference = referencePour(edition, 14, List.of(
                releve(edition, 1, 12, "51.00", AUJOURD_HUI.minusMonths(18)),
                releve(edition, 1, 12, "54.00", AUJOURD_HUI.minusMonths(20)),
                releve(edition, 1, 12, "49.20", AUJOURD_HUI.minusMonths(15))));

        assertThat(reference.sampleSize()).isEqualTo(3);
        assertThat(reference.confidence()).isEqualTo(MarketReferenceConfidence.MEDIUM);
        assertThat(reference.mostRecentObservation()).isEqualTo(AUJOURD_HUI.minusMonths(15));
    }

    // ================================================ Absences well distinguished

    @Test
    void une_edition_absente_du_catalogue_se_dit_autrement_qu_une_edition_sans_releve() {
        MarketReference sansEdition = MarketReference.fromComparables(null, 14,
                MarketComparableSelector.selectFor(null, 14, List.of(), AUJOURD_HUI), AUJOURD_HUI);
        MangaEdition edition = platinumEnd(14);
        MarketReference sansReleve = referencePour(edition, 14, List.of());

        assertThat(sansEdition.gap()).isEqualTo(ReferenceGap.EDITION_NOT_IN_CATALOGUE);
        assertThat(sansReleve.gap()).isEqualTo(ReferenceGap.NO_OBSERVATION);
        // Two causes, two pieces of advice: "complete the work page" against "record a price".
        assertThat(sansEdition.gap()).isNotEqualTo(sansReleve.gap());
    }

    // ========================================================= Multi-series batches

    @Test
    void un_lot_multi_series_dont_une_serie_manque_n_a_pas_de_reference() {
        MangaEdition edition = serieLongue();
        MarketReference connue = referencePour(edition, 14, List.of(
                releve(edition, 1, 12, "51.00"),
                releve(edition, 1, 10, "40.00"),
                releve(edition, 2, 14, "58.50")));
        MarketReference inconnue = MarketReference.unavailable(ReferenceGap.NO_OBSERVATION, 0);

        MarketReference lot = MarketReference.sum(List.of(connue, inconnue));

        // Summing only the known series would give a reference that is too low, so
        // a batch that is always "too expensive".
        assertThat(lot.price()).isNull();
        assertThat(lot.confidence()).isEqualTo(MarketReferenceConfidence.UNAVAILABLE);
        assertThat(lot.gap()).isEqualTo(ReferenceGap.INCOMPLETE_LOT_COVERAGE);
    }

    @Test
    void un_lot_multi_series_bien_documente_ne_depasse_pas_MEDIUM() {
        MangaEdition edition = serieLongue();
        MarketReference serie = referencePour(edition, 14, List.of(
                releve(edition, 1, 12, "51.00"),
                releve(edition, 1, 10, "40.00"),
                releve(edition, 2, 14, "58.50")));
        assertThat(serie.confidence()).isEqualTo(MarketReferenceConfidence.HIGH);

        MarketReference lot = MarketReference.sum(List.of(serie, serie));

        // Putting two unit references side by side to judge a batch remains an
        // approximation, even when each term is solid.
        assertThat(lot.price()).isEqualByComparingTo("119.00");
        assertThat(lot.confidence()).isEqualTo(MarketReferenceConfidence.MEDIUM);
        // The announced sample is that of the weakest link, not the sum.
        assertThat(lot.sampleSize()).isEqualTo(3);
    }

    @Test
    void une_serie_seule_conserve_sa_confiance_faible_au_lieu_de_devenir_une_absence() {
        MangaEdition edition = serieLongue();
        MarketReference faible = referencePour(edition, 14, List.of(releve(edition, 1, 12, "51.00")));

        MarketReference lot = MarketReference.sum(List.of(faible));

        // LOW is not UNAVAILABLE: the price cannot be positioned, but the screen
        // can say "a single comparable" rather than "no data", which
        // is false and helps nobody.
        assertThat(lot.confidence()).isEqualTo(MarketReferenceConfidence.LOW);
        assertThat(lot.sampleSize()).isEqualTo(1);
        assertThat(lot.gap()).isEqualTo(ReferenceGap.NONE);
        assertThat(lot.isUsable()).isFalse();
    }

    @Test
    void une_reference_sans_prix_ne_peut_pas_pretendre_positionner() {
        // The structural safeguard: the combination is refused at construction.
        assertThat(MarketReferenceConfidence.UNAVAILABLE.allowsPositioning()).isFalse();
        assertThat(MarketReferenceConfidence.LOW.allowsPositioning()).isFalse();
        assertThat(MarketReferenceConfidence.MEDIUM.allowsPositioning()).isTrue();
        assertThat(MarketReferenceConfidence.HIGH.allowsPositioning()).isTrue();

        org.assertj.core.api.Assertions.assertThatThrownBy(() -> new MarketReference(
                        null, MarketReferenceConfidence.HIGH, 3, 3, 3, MarketReferenceSource.OBSERVED_COMPARABLES,
                        LotShape.PARTIAL_LOT, 10, AUJOURD_HUI, ReferenceGap.NONE))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
