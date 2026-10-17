package com.iozycore.manga.domain.deals;

import com.iozycore.manga.domain.EditionTier;
import com.iozycore.manga.domain.MangaEdition;
import com.iozycore.core.listing.ShippingEstimateKind;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import com.iozycore.core.listing.ListingPlatform;

/**
 * <b>Two quantities, two uses — and above all, never the same one.</b>
 *
 * <h2>The bias these tests forbid</h2>
 * The prices of comparable listings are shown <b>without fees</b>. Comparing an
 * acquisition cost with fees included (14.03 EUR) to a median without fees (12 EUR)
 * would compare two different things and declare "too expensive"
 * a listing that is not. The market positioning is therefore done on the
 * <b>price of the item alone</b>.
 * <p>
 * Conversely, what the purchase really costs includes protection and
 * delivery: it is <b>this amount</b> that must be used for the cost per useful
 * item, otherwise the user thinks they pay 5 EUR a volume when they pay 7.
 *
 * <h2>And "minimum" is not "real"</h2>
 * When several delivery modes exist, the source shows the cheapest:
 * the resulting total is a floor, and the saved analysis must
 * remember it - a "from 2.83 EUR" must never be read back later
 * as a firm rate.
 */
class PriceSemanticsTest {

    private static Listing annonce(BigDecimal prixArticle, BigDecimal port, ShippingEstimateKind nature,
                                    BigDecimal protection) {
        return new Listing(UUID.randomUUID(), ListingPlatform.VINTED, null, "Lot de test", null,
                prixArticle, port, nature, protection, Condition.VERY_GOOD, false,
                List.of(new ListingItem(new MangaSeries("Une serie", null), "Standard", java.util.Set.of(1, 2), null)),
                List.of(), Instant.now());
    }

    // ------------------------------------------------ The separation of bases

    @Test
    void le_positionnement_marche_se_fait_sur_le_prix_de_l_article_pas_sur_le_cout_d_acquisition() {
        // The case of the specification: 10 + 1.20 + "from 2.83" = 14.03,
        // against a comparable median of 12 (without fees, like every listing).
        Listing listing = annonce(new BigDecimal("10"), new BigDecimal("2.83"),
                ShippingEstimateKind.FROM, new BigDecimal("1.20"));
        BigDecimal medianeComparable = new BigDecimal("12");

        assertThat(listing.totalRealCost()).isEqualByComparingTo("14.03");

        // Compared on the PRICE OF THE ITEM: 10 against 12 = below the reference.
        PricePosition surPrixArticle = DealAssessmentPolicy.positionOf(
                listing.askingPrice(), medianeComparable, MarketReferenceConfidence.HIGH);
        // Compared on the acquisition cost, it would be 14.03 against 12: "expensive".
        PricePosition surCoutAcquisition = DealAssessmentPolicy.positionOf(
                listing.totalRealCost(), medianeComparable, MarketReferenceConfidence.HIGH);

        assertThat(surPrixArticle).isEqualTo(PricePosition.GOOD_PRICE);
        assertThat(surCoutAcquisition).isEqualTo(PricePosition.RATHER_EXPENSIVE);
        // The two differ: this is exactly why mixing the bases
        // would reverse the verdict of a correct listing.
        assertThat(surPrixArticle).isNotEqualTo(surCoutAcquisition);
    }

    @Test
    void le_cout_par_element_utile_se_calcule_sur_le_cout_d_acquisition_pas_sur_le_prix_affiche() {
        Listing listing = annonce(new BigDecimal("10"), new BigDecimal("2.83"),
                ShippingEstimateKind.FROM, new BigDecimal("1.20"));

        // 2 items, all useful: 14.03 / 2, not 10 / 2.
        CollectionFit fit = CollectionFit.of(2, 0, 0, listing.totalRealCost());

        assertThat(fit.pricePerUsefulItem()).isEqualByComparingTo("7.02");
        // The price shown alone would give 5.00 EUR - the user would think they pay
        // 30 % less than reality.
        assertThat(fit.pricePerUsefulItem()).isNotEqualByComparingTo("5.00");
    }

    @Test
    void la_vigilance_sur_un_prix_bas_se_juge_aussi_sur_le_prix_de_l_article() {
        // Otherwise fees would artificially inflate the price and hide
        // an item that is really sold off.
        Listing listing = annonce(new BigDecimal("4"), new BigDecimal("3"),
                ShippingEstimateKind.FROM, new BigDecimal("1"));

        ListingTrustAssessment surArticle = ListingTrustAssessment.assess(
                null, 5, listing.askingPrice(), new BigDecimal("20"));

        assertThat(surArticle.signals()).contains(TrustSignal.PRICE_FAR_BELOW_REFERENCE);
    }

    // ------------------------------------------- Estimated minimum vs firm cost

    @Test
    void un_port_a_partir_de_rend_le_cout_d_acquisition_minimal_pas_ferme() {
        Listing listing = annonce(new BigDecimal("10"), new BigDecimal("2.83"),
                ShippingEstimateKind.FROM, new BigDecimal("1.20"));

        assertThat(listing.totalRealCost()).isEqualByComparingTo("14.03");
        // 14.03 EUR is a floor: the chosen pickup point may cost more.
        assertThat(listing.acquisitionCostIsLowerBound()).isTrue();
    }

    @Test
    void un_port_ferme_ou_offert_donne_un_cout_qui_n_est_pas_un_plancher() {
        assertThat(annonce(new BigDecimal("10"), new BigDecimal("2.83"),
                ShippingEstimateKind.EXACT, new BigDecimal("1.20")).acquisitionCostIsLowerBound()).isFalse();
        assertThat(annonce(new BigDecimal("10"), BigDecimal.ZERO,
                ShippingEstimateKind.FREE, new BigDecimal("1.20")).acquisitionCostIsLowerBound()).isFalse();
    }

    @Test
    void une_livraison_offerte_vaut_zero_et_se_distingue_d_une_livraison_inconnue() {
        Listing offerte = annonce(new BigDecimal("10"), BigDecimal.ZERO,
                ShippingEstimateKind.FREE, new BigDecimal("1.20"));
        Listing inconnue = annonce(new BigDecimal("10"), null,
                ShippingEstimateKind.UNKNOWN, new BigDecimal("1.20"));

        // Both total 11.20 for lack of better, but do not mean the
        // same thing: one is complete, the other incomplete. Only the nature
        // lets the screen say so.
        assertThat(offerte.totalRealCost()).isEqualByComparingTo("11.20");
        assertThat(offerte.shippingKind()).isEqualTo(ShippingEstimateKind.FREE);
        assertThat(inconnue.shippingKind()).isEqualTo(ShippingEstimateKind.UNKNOWN);
    }

    @Test
    void une_nature_absente_ne_devient_jamais_une_livraison_offerte() {
        // The trap: assuming FREE would understate the cost without anything signalling it.
        Listing sansNature = sansNature(null);

        assertThat(sansNature.shippingKind()).isEqualTo(ShippingEstimateKind.UNKNOWN);
    }

    /** Same listing, nature deliberately omitted: the domain decides. */
    private static Listing sansNature(BigDecimal port) {
        return new Listing(UUID.randomUUID(), ListingPlatform.VINTED, null, "Lot", null,
                new BigDecimal("10"), port, null, new BigDecimal("1.20"), Condition.VERY_GOOD, false,
                List.of(new ListingItem(new MangaSeries("Une serie", null), "Standard", java.util.Set.of(1), null)),
                List.of(), Instant.now());
    }

    // --------------------------------------- An entered amount is not "unknown"

    @Test
    void un_port_saisi_a_la_main_est_estime_compte_dans_le_cout_et_n_est_jamais_dit_non_communique() {
        // The exact case of the specification: 10 + 1.20 + 5.90 entered.
        Listing listing = annonce(new BigDecimal("10"), new BigDecimal("5.90"),
                ShippingEstimateKind.ESTIMATED, new BigDecimal("1.20"));

        assertThat(listing.shippingKind()).isEqualTo(ShippingEstimateKind.ESTIMATED);
        assertThat(listing.totalRealCost()).isEqualByComparingTo("17.10");
        // Neither a floor (nothing says it will cost more), nor an absence:
        // this last point is what forbids the display "not communicated".
        assertThat(listing.acquisitionCostIsLowerBound()).isFalse();
        assertThat(listing.acquisitionCostIncludesShipping()).isTrue();
        assertThat(listing.shippingKind().isEstimate()).isTrue();
    }

    @Test
    void un_zero_sans_nature_reste_inconnu_et_ne_se_dit_jamais_estime() {
        // The case of analyses earlier than this nature: the shipping was zero
        // by default, without anybody having observed anything. "0.00 EUR
        // estimated" would claim a free delivery that nobody said; a
        // really free delivery comes with FREE.
        Listing relu = sansNature(BigDecimal.ZERO);

        assertThat(relu.shippingKind()).isEqualTo(ShippingEstimateKind.UNKNOWN);
        assertThat(relu.acquisitionCostIncludesShipping()).isFalse();
        // FREE, for its part, stays a real observed zero.
        assertThat(annonce(new BigDecimal("10"), BigDecimal.ZERO, ShippingEstimateKind.FREE,
                new BigDecimal("1.20")).acquisitionCostIncludesShipping()).isTrue();
    }

    @Test
    void un_montant_recu_sans_nature_est_estime_pas_ferme() {
        // Nobody claimed that this rate was the one that would be charged:
        // naming it EXACT would give a received number the authority of a rate read.
        assertThat(sansNature(new BigDecimal("5.90")).shippingKind())
                .isEqualTo(ShippingEstimateKind.ESTIMATED);
    }

    @Test
    void un_inconnu_ne_porte_jamais_un_montant_qui_entre_dans_le_calcul() {
        // THE contradiction to make impossible: the total would include 5.90 while
        // the screen announced "delivery not communicated".
        Listing contradictoire = annonce(new BigDecimal("10"), new BigDecimal("5.90"),
                ShippingEstimateKind.UNKNOWN, new BigDecimal("1.20"));

        assertThat(contradictoire.shippingKind()).isEqualTo(ShippingEstimateKind.ESTIMATED);
        assertThat(contradictoire.totalRealCost()).isEqualByComparingTo("17.10");
        // In other words: no combination lets UNKNOWN charge anything
        // at all. This normalisation also repairs, on read-back, the
        // analyses saved before this case had a name.
        assertThat(contradictoire.shippingKind().hasAmount()).isTrue();
    }

    // ------------------------------------------- Partially known cost

    @Test
    void une_livraison_inconnue_ne_produit_pas_un_cout_d_acquisition_complet() {
        Listing listing = annonce(new BigDecimal("10"), null,
                ShippingEstimateKind.UNKNOWN, new BigDecimal("1.20"));

        // The total can still be computed - it is a known subtotal, not an
        // acquisition cost: the screen must name it that way and say what is missing.
        assertThat(listing.totalRealCost()).isEqualByComparingTo("11.20");
        assertThat(listing.acquisitionCostIncludesShipping()).isFalse();
        assertThat(listing.acquisitionCostIsLowerBound()).isFalse();
    }

    @Test
    void toutes_les_natures_porteuses_d_un_montant_contribuent_au_cout() {
        for (ShippingEstimateKind nature : List.of(ShippingEstimateKind.FREE, ShippingEstimateKind.EXACT,
                ShippingEstimateKind.FROM, ShippingEstimateKind.ESTIMATED)) {
            assertThat(nature.hasAmount()).as(nature.name()).isTrue();
        }
        assertThat(ShippingEstimateKind.UNKNOWN.hasAmount()).isFalse();
        // Only FROM makes the total a minimum: an estimate is not a floor.
        assertThat(ShippingEstimateKind.ESTIMATED.isLowerBound()).isFalse();
        assertThat(ShippingEstimateKind.FROM.isLowerBound()).isTrue();
    }

    @Test
    void la_semantique_du_port_est_figee_avec_l_analyse() {
        // A "from" saved today must be read back as "from"
        // tomorrow: it is a component of the Listing, not a calculation redone on read.
        Listing listing = annonce(new BigDecimal("10"), new BigDecimal("2.83"),
                ShippingEstimateKind.FROM, new BigDecimal("1.20"));

        assertThat(listing.shippingKind()).isEqualTo(ShippingEstimateKind.FROM);
        assertThat(ShippingEstimateKind.FROM.isLowerBound()).isTrue();
        assertThat(ShippingEstimateKind.EXACT.isLowerBound()).isFalse();
        assertThat(ShippingEstimateKind.UNKNOWN.hasAmount()).isFalse();
        assertThat(ShippingEstimateKind.FREE.hasAmount()).isTrue();
    }

    // ============ The whole engine, not only the isolated rule ============

    /**
     * The tests above lock the <i>rule</i>. This one locks the
     * <i>wiring</i>: that the engine does pass the listing price to the
     * market positioning, and the acquisition cost to the collection
     * contribution. A correct rule badly wired produces exactly the same
     * wrong figure.
     */
    @Test
    void le_moteur_positionne_sur_le_prix_de_l_annonce_et_chiffre_l_apport_sur_le_cout_d_acquisition() {
        MangaEdition edition = MangaEdition.create("Berserk", "Standard", EditionTier.STANDARD, "Glenat",
                20, new BigDecimal("8.50"), false, false, null);
        // Three comparable batches at 5.00 EUR a volume: solid reference of 50 EUR
        // for the 10 volumes assessed.
        List<MarketPriceObservation> comparables = List.of(
                observation(edition, 8, "40.00"), observation(edition, 10, "50.00"),
                observation(edition, 12, "60.00"));

        ListingItem item = new ListingItem(new MangaSeries("Berserk", null), "Standard",
                Set.of(1, 2, 3, 4, 5, 6, 7, 8, 9, 10), null);
        // 44 EUR of listing, 12 EUR of fees: the total exceeds the reference, the
        // listing price does not. The whole point lies in this gap.
        Listing listing = new Listing(UUID.randomUUID(), ListingPlatform.VINTED, null, "Lot Berserk", null,
                new BigDecimal("44"), new BigDecimal("10"), ShippingEstimateKind.EXACT, new BigDecimal("2"),
                Condition.VERY_GOOD, false, List.of(item), List.of(), Instant.now());
        assertThat(listing.totalRealCost()).isEqualByComparingTo("56.00");

        PurchaseAnalysis analyse = new PurchaseAnalysisEngine().analyze(listing,
                List.of(new PurchaseAnalysisEngine.ItemContext(item, edition, List.of(), comparables, Set.of())),
                CollectorPreferences.defaults());
        ListingAssessment assessment = analyse.assessment();

        assertThat(assessment.referencePrice()).isEqualByComparingTo("50.00");
        assertThat(assessment.referenceSampleSize()).isEqualTo(3);
        assertThat(assessment.referenceSource()).isEqualTo(MarketReferenceSource.OBSERVED_COMPARABLES);

        // 44 / 50 = 0.88 -> fair price. On 56 / 50 = 1.12, it would be
        // "rather expensive": two opposite verdicts on the same listing.
        assertThat(assessment.pricePosition()).isEqualTo(PricePosition.FAIR_PRICE);
        assertThat(DealAssessmentPolicy.positionOf(listing.totalRealCost(), new BigDecimal("50"),
                MarketReferenceConfidence.HIGH)).isEqualTo(PricePosition.RATHER_EXPENSIVE);
        assertThat(assessment.deviationPercent()).isEqualTo(-12);

        // The contribution, for its part, is computed on the 56 EUR really committed.
        assertThat(assessment.collectionFit().pricePerItem()).isEqualByComparingTo("5.60");
        assertThat(assessment.collectionFit().pricePerItem()).isNotEqualByComparingTo("4.40");
    }

    @Test
    void une_reference_inexploitable_ne_sort_ni_en_prix_ni_en_ecart() {
        MangaEdition edition = MangaEdition.create("Platinum End", "Standard", EditionTier.STANDARD, "Kaze",
                14, new BigDecimal("6.99"), false, false, null);
        // The Platinum End case: a T.1 and two batches of 4 against a complete set.
        List<MarketPriceObservation> incomparables = List.of(
                observation(edition, 1, "8.00"), observation(edition, 4, "20.00"),
                observation(edition, 4, "18.00"));

        ListingItem item = new ListingItem(new MangaSeries("Platinum End", null), "Standard",
                Set.of(1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14), null);
        Listing listing = new Listing(UUID.randomUUID(), ListingPlatform.VINTED, null, "Lot Platinum End", null,
                new BigDecimal("60"), BigDecimal.ZERO, ShippingEstimateKind.FREE, BigDecimal.ZERO,
                Condition.VERY_GOOD, false, List.of(item), List.of(), Instant.now());

        ListingAssessment assessment = new PurchaseAnalysisEngine().analyze(listing,
                List.of(new PurchaseAnalysisEngine.ItemContext(item, edition, List.of(), incomparables, Set.of())),
                CollectorPreferences.defaults()).assessment();

        // No figure shown: a price on screen is a price one believes.
        assertThat(assessment.referencePrice()).isNull();
        assertThat(assessment.deviationPercent()).isNull();
        assertThat(assessment.pricePosition()).isEqualTo(PricePosition.REFERENCE_UNAVAILABLE);
        assertThat(assessment.referenceConfidence()).isEqualTo(MarketReferenceConfidence.UNAVAILABLE);
        assertThat(assessment.referenceGap()).isEqualTo(ReferenceGap.NO_COMPARABLE_SHAPE);
        // And no "price clearly below" drawn from a non-existent reference.
        assertThat(assessment.trust().signals()).doesNotContain(TrustSignal.PRICE_FAR_BELOW_REFERENCE);
        // "No data" and "records, but no comparable" do not mean the
        // same thing: the three records exist, it is their SHAPE that does not
        // match. The screen needs the count to say so.
        assertThat(assessment.referenceExaminedCount()).isEqualTo(3);
        assertThat(assessment.referenceSampleSize()).isZero();
    }

    /**
     * A reference price is not read alone: what lets us
     * <i>discuss</i> it - how many comparables, how well they agree, how
     * old the most recent one is - must be frozen IN the analysis. These three
     * caveats already existed in {@link MarketReference}, but stopped at the
     * calculation: the screen showed "good confidence" to be taken on faith.
     */
    @Test
    void les_reserves_de_la_reference_sont_figees_avec_le_prix() {
        MangaEdition edition = MangaEdition.create("Vagabond", "Standard", EditionTier.STANDARD, "Tonkam",
                37, new BigDecimal("7.60"), false, false, null);
        LocalDate plusRecent = LocalDate.now().minusDays(9);
        // Three batches of 10 volumes at 4.50 / 5.00 / 5.50 EUR a volume: median 5.00,
        // dispersion (5.50 - 4.50) / 5.00 = 20 %.
        List<MarketPriceObservation> comparables = List.of(
                observation(edition, 10, "45.00"), observation(edition, 10, "55.00"),
                MarketPriceObservation.record_(edition.id(), new VolumeRange(1, 10), new BigDecimal("50.00"),
                        ListingPlatform.VINTED, Condition.VERY_GOOD, plusRecent, null));

        ListingItem item = new ListingItem(new MangaSeries("Vagabond", null), "Standard",
                Set.of(1, 2, 3, 4, 5, 6, 7, 8, 9, 10), null);
        Listing listing = new Listing(UUID.randomUUID(), ListingPlatform.VINTED, null, "Lot Vagabond", null,
                new BigDecimal("48"), BigDecimal.ZERO, ShippingEstimateKind.FREE, BigDecimal.ZERO,
                Condition.VERY_GOOD, false, List.of(item), List.of(), Instant.now());

        ListingAssessment assessment = new PurchaseAnalysisEngine().analyze(listing,
                List.of(new PurchaseAnalysisEngine.ItemContext(item, edition, List.of(), comparables, Set.of())),
                CollectorPreferences.defaults()).assessment();

        assertThat(assessment.referencePrice()).isEqualByComparingTo("50.00");
        assertThat(assessment.referenceSampleSize()).isEqualTo(3);
        assertThat(assessment.referenceExaminedCount()).isEqualTo(3);
        assertThat(assessment.referenceSpreadPercent()).isEqualTo(20);
        assertThat(assessment.referenceMostRecentObservation()).isEqualTo(plusRecent);
    }

    /** A batch of {@code tomes} volumes starting from volume 1, recorded two months ago. */
    private static MarketPriceObservation observation(MangaEdition edition, int tomes, String prix) {
        return MarketPriceObservation.record_(edition.id(), new VolumeRange(1, tomes), new BigDecimal(prix),
                ListingPlatform.VINTED, Condition.VERY_GOOD, LocalDate.now().minusMonths(2), null);
    }
}
