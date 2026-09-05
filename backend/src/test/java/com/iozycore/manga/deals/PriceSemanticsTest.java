package com.iozycore.manga.deals;

import com.iozycore.manga.domain.EditionTier;
import com.iozycore.manga.domain.MangaEdition;
import com.iozycore.listing.ShippingEstimateKind;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import com.iozycore.listing.ListingPlatform;

/**
 * <b>Deux grandeurs, deux usages — et surtout, jamais la même.</b>
 *
 * <h2>Le biais que ces tests interdisent</h2>
 * Les prix d'annonces comparables sont affichés <b>hors frais</b>. Comparer un
 * coût d'acquisition frais compris (14,03 €) à une médiane hors frais (12 €)
 * reviendrait à comparer deux choses différentes et à déclarer « trop cher »
 * une annonce qui ne l'est pas. Le positionnement marché se fait donc sur le
 * <b>prix de l'article seul</b>.
 * <p>
 * À l'inverse, ce que l'achat coûte vraiment inclut la protection et la
 * livraison : c'est <b>ce montant-là</b> qui doit servir au coût par élément
 * utile, sinon l'utilisateur croit payer 5 € le tome quand il en paie 7.
 *
 * <h2>Et « minimum » n'est pas « réel »</h2>
 * Quand plusieurs modes de livraison existent, la source affiche le moins
 * cher : le total qui en découle est un plancher, et l'analyse enregistrée doit
 * s'en souvenir - un « à partir de 2,83 € » ne doit jamais se relire plus tard
 * comme un tarif ferme.
 */
class PriceSemanticsTest {

    private static Listing annonce(BigDecimal prixArticle, BigDecimal port, ShippingEstimateKind nature,
                                    BigDecimal protection) {
        return new Listing(UUID.randomUUID(), ListingPlatform.VINTED, null, "Lot de test", null,
                prixArticle, port, nature, protection, Condition.VERY_GOOD, false,
                List.of(new ListingItem(new MangaSeries("Une serie", null), "Standard", java.util.Set.of(1, 2), null)),
                List.of(), Instant.now());
    }

    // ------------------------------------------------ La séparation des bases

    @Test
    void le_positionnement_marche_se_fait_sur_le_prix_de_l_article_pas_sur_le_cout_d_acquisition() {
        // Le cas du cahier des charges : 10 + 1,20 + « à partir de 2,83 » = 14,03,
        // contre une médiane comparable de 12 (hors frais, comme toute annonce).
        Listing listing = annonce(new BigDecimal("10"), new BigDecimal("2.83"),
                ShippingEstimateKind.FROM, new BigDecimal("1.20"));
        BigDecimal medianeComparable = new BigDecimal("12");

        assertThat(listing.totalRealCost()).isEqualByComparingTo("14.03");

        // Comparé sur le PRIX DE L'ARTICLE : 10 contre 12 = sous la référence.
        PricePosition surPrixArticle = DealAssessmentPolicy.positionOf(
                listing.askingPrice(), medianeComparable, MarketReferenceConfidence.HIGH);
        // Comparé sur le coût d'acquisition, ce serait 14,03 contre 12 : « cher ».
        PricePosition surCoutAcquisition = DealAssessmentPolicy.positionOf(
                listing.totalRealCost(), medianeComparable, MarketReferenceConfidence.HIGH);

        assertThat(surPrixArticle).isEqualTo(PricePosition.GOOD_PRICE);
        assertThat(surCoutAcquisition).isEqualTo(PricePosition.RATHER_EXPENSIVE);
        // Les deux diffèrent : c'est exactement pourquoi confondre les bases
        // renverserait le verdict d'une annonce correcte.
        assertThat(surPrixArticle).isNotEqualTo(surCoutAcquisition);
    }

    @Test
    void le_cout_par_element_utile_se_calcule_sur_le_cout_d_acquisition_pas_sur_le_prix_affiche() {
        Listing listing = annonce(new BigDecimal("10"), new BigDecimal("2.83"),
                ShippingEstimateKind.FROM, new BigDecimal("1.20"));

        // 2 éléments, tous utiles : 14,03 / 2, pas 10 / 2.
        CollectionFit fit = CollectionFit.of(2, 0, 0, listing.totalRealCost());

        assertThat(fit.pricePerUsefulItem()).isEqualByComparingTo("7.02");
        // Le prix affiché seul donnerait 5,00 € - l'utilisateur croirait payer
        // 30 % de moins que la réalité.
        assertThat(fit.pricePerUsefulItem()).isNotEqualByComparingTo("5.00");
    }

    @Test
    void la_vigilance_sur_un_prix_bas_se_juge_aussi_sur_le_prix_de_l_article() {
        // Sinon les frais gonfleraient artificiellement le prix et masqueraient
        // un article réellement bradé.
        Listing listing = annonce(new BigDecimal("4"), new BigDecimal("3"),
                ShippingEstimateKind.FROM, new BigDecimal("1"));

        ListingTrustAssessment surArticle = ListingTrustAssessment.assess(
                null, 5, listing.askingPrice(), new BigDecimal("20"));

        assertThat(surArticle.signals()).contains(TrustSignal.PRICE_FAR_BELOW_REFERENCE);
    }

    // ------------------------------------------- Minimum estimé vs coût ferme

    @Test
    void un_port_a_partir_de_rend_le_cout_d_acquisition_minimal_pas_ferme() {
        Listing listing = annonce(new BigDecimal("10"), new BigDecimal("2.83"),
                ShippingEstimateKind.FROM, new BigDecimal("1.20"));

        assertThat(listing.totalRealCost()).isEqualByComparingTo("14.03");
        // 14,03 € est un plancher : le point relais choisi peut coûter plus.
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

        // Les deux totalisent 11,20 faute de mieux, mais ne veulent pas dire la
        // même chose : l'une est complète, l'autre incomplète. Seule la nature
        // permet à l'écran de le dire.
        assertThat(offerte.totalRealCost()).isEqualByComparingTo("11.20");
        assertThat(offerte.shippingKind()).isEqualTo(ShippingEstimateKind.FREE);
        assertThat(inconnue.shippingKind()).isEqualTo(ShippingEstimateKind.UNKNOWN);
    }

    @Test
    void une_nature_absente_ne_devient_jamais_une_livraison_offerte() {
        // Le piège : supposer FREE minorerait le coût sans que rien ne le signale.
        Listing sansNature = sansNature(null);

        assertThat(sansNature.shippingKind()).isEqualTo(ShippingEstimateKind.UNKNOWN);
    }

    /** Même annonce, nature volontairement omise : c'est le domaine qui tranche. */
    private static Listing sansNature(BigDecimal port) {
        return new Listing(UUID.randomUUID(), ListingPlatform.VINTED, null, "Lot", null,
                new BigDecimal("10"), port, null, new BigDecimal("1.20"), Condition.VERY_GOOD, false,
                List.of(new ListingItem(new MangaSeries("Une serie", null), "Standard", java.util.Set.of(1), null)),
                List.of(), Instant.now());
    }

    // --------------------------------------- Un montant saisi n'est pas « inconnu »

    @Test
    void un_port_saisi_a_la_main_est_estime_compte_dans_le_cout_et_n_est_jamais_dit_non_communique() {
        // Le cas exact du cahier des charges : 10 + 1,20 + 5,90 saisis.
        Listing listing = annonce(new BigDecimal("10"), new BigDecimal("5.90"),
                ShippingEstimateKind.ESTIMATED, new BigDecimal("1.20"));

        assertThat(listing.shippingKind()).isEqualTo(ShippingEstimateKind.ESTIMATED);
        assertThat(listing.totalRealCost()).isEqualByComparingTo("17.10");
        // Ni un plancher (rien ne dit que ce sera plus cher), ni une absence :
        // c'est ce dernier point qui interdit l'affichage « non communiquée ».
        assertThat(listing.acquisitionCostIsLowerBound()).isFalse();
        assertThat(listing.acquisitionCostIncludesShipping()).isTrue();
        assertThat(listing.shippingKind().isEstimate()).isTrue();
    }

    @Test
    void un_zero_sans_nature_reste_inconnu_et_ne_se_dit_jamais_estime() {
        // Le cas des analyses anterieures a cette nature : le port valait zero
        // par defaut, sans que personne n'ait rien constate. « 0,00 EUR
        // estimes » affirmerait une livraison gratuite que nul n'a dite ; une
        // livraison reellement offerte arrive avec FREE.
        Listing relu = sansNature(BigDecimal.ZERO);

        assertThat(relu.shippingKind()).isEqualTo(ShippingEstimateKind.UNKNOWN);
        assertThat(relu.acquisitionCostIncludesShipping()).isFalse();
        // FREE, lui, reste un vrai zero constate.
        assertThat(annonce(new BigDecimal("10"), BigDecimal.ZERO, ShippingEstimateKind.FREE,
                new BigDecimal("1.20")).acquisitionCostIncludesShipping()).isTrue();
    }

    @Test
    void un_montant_recu_sans_nature_est_estime_pas_ferme() {
        // Personne n'a affirmé que ce tarif était celui qui serait facturé :
        // le nommer EXACT donnerait à un nombre reçu l'autorité d'un tarif lu.
        assertThat(sansNature(new BigDecimal("5.90")).shippingKind())
                .isEqualTo(ShippingEstimateKind.ESTIMATED);
    }

    @Test
    void un_inconnu_ne_porte_jamais_un_montant_qui_entre_dans_le_calcul() {
        // LA contradiction à rendre impossible : le total inclurait 5,90 pendant
        // que l'écran annoncerait « livraison non communiquée ».
        Listing contradictoire = annonce(new BigDecimal("10"), new BigDecimal("5.90"),
                ShippingEstimateKind.UNKNOWN, new BigDecimal("1.20"));

        assertThat(contradictoire.shippingKind()).isEqualTo(ShippingEstimateKind.ESTIMATED);
        assertThat(contradictoire.totalRealCost()).isEqualByComparingTo("17.10");
        // Autrement dit : aucune combinaison ne laisse UNKNOWN facturer quoi que
        // ce soit. Cette normalisation répare aussi, à la relecture, les
        // analyses enregistrées avant que ce cas ait un nom.
        assertThat(contradictoire.shippingKind().hasAmount()).isTrue();
    }

    // ------------------------------------------- Coût partiellement connu

    @Test
    void une_livraison_inconnue_ne_produit_pas_un_cout_d_acquisition_complet() {
        Listing listing = annonce(new BigDecimal("10"), null,
                ShippingEstimateKind.UNKNOWN, new BigDecimal("1.20"));

        // Le total reste calculable - c'est un sous-total connu, pas un coût
        // d'acquisition : l'écran doit le nommer ainsi et dire ce qui manque.
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
        // Seul FROM rend le total minimal : une estimation n'est pas un plancher.
        assertThat(ShippingEstimateKind.ESTIMATED.isLowerBound()).isFalse();
        assertThat(ShippingEstimateKind.FROM.isLowerBound()).isTrue();
    }

    @Test
    void la_semantique_du_port_est_figee_avec_l_analyse() {
        // Un « à partir de » enregistré aujourd'hui doit se relire « à partir de »
        // demain : c'est un composant du Listing, pas un calcul refait à la lecture.
        Listing listing = annonce(new BigDecimal("10"), new BigDecimal("2.83"),
                ShippingEstimateKind.FROM, new BigDecimal("1.20"));

        assertThat(listing.shippingKind()).isEqualTo(ShippingEstimateKind.FROM);
        assertThat(ShippingEstimateKind.FROM.isLowerBound()).isTrue();
        assertThat(ShippingEstimateKind.EXACT.isLowerBound()).isFalse();
        assertThat(ShippingEstimateKind.UNKNOWN.hasAmount()).isFalse();
        assertThat(ShippingEstimateKind.FREE.hasAmount()).isTrue();
    }

    // ============ Le moteur entier, pas seulement la regle isolee ============

    /**
     * Les tests ci-dessus verrouillent la <i>regle</i>. Celui-ci verrouille le
     * <i>cablage</i> : que le moteur passe bien le prix de l'annonce au
     * positionnement marche, et bien le cout d'acquisition a l'apport
     * collection. Une regle juste mal branchee produit exactement le meme
     * chiffre faux.
     */
    @Test
    void le_moteur_positionne_sur_le_prix_de_l_annonce_et_chiffre_l_apport_sur_le_cout_d_acquisition() {
        MangaEdition edition = MangaEdition.create("Berserk", "Standard", EditionTier.STANDARD, "Glenat",
                20, new BigDecimal("8.50"), false, false, null);
        // Trois lots comparables a 5,00 EUR le tome : reference solide de 50 EUR
        // pour les 10 tomes evalues.
        List<MarketPriceObservation> comparables = List.of(
                observation(edition, 8, "40.00"), observation(edition, 10, "50.00"),
                observation(edition, 12, "60.00"));

        ListingItem item = new ListingItem(new MangaSeries("Berserk", null), "Standard",
                Set.of(1, 2, 3, 4, 5, 6, 7, 8, 9, 10), null);
        // 44 EUR d'annonce, 12 EUR de frais : le total depasse la reference, le
        // prix de l'annonce non. Tout l'enjeu tient dans cet ecart.
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

        // 44 / 50 = 0,88 -> prix correct. Sur 56 / 50 = 1,12, ce serait
        // "plutot cher" : deux verdicts opposes sur la meme annonce.
        assertThat(assessment.pricePosition()).isEqualTo(PricePosition.FAIR_PRICE);
        assertThat(DealAssessmentPolicy.positionOf(listing.totalRealCost(), new BigDecimal("50"),
                MarketReferenceConfidence.HIGH)).isEqualTo(PricePosition.RATHER_EXPENSIVE);
        assertThat(assessment.deviationPercent()).isEqualTo(-12);

        // L'apport, lui, se chiffre bien sur les 56 EUR reellement engages.
        assertThat(assessment.collectionFit().pricePerItem()).isEqualByComparingTo("5.60");
        assertThat(assessment.collectionFit().pricePerItem()).isNotEqualByComparingTo("4.40");
    }

    @Test
    void une_reference_inexploitable_ne_sort_ni_en_prix_ni_en_ecart() {
        MangaEdition edition = MangaEdition.create("Platinum End", "Standard", EditionTier.STANDARD, "Kaze",
                14, new BigDecimal("6.99"), false, false, null);
        // Le cas Platinum End : un T.1 et deux lots de 4 face a une integrale.
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

        // Aucun chiffre affiche : un prix a l'ecran est un prix auquel on croit.
        assertThat(assessment.referencePrice()).isNull();
        assertThat(assessment.deviationPercent()).isNull();
        assertThat(assessment.pricePosition()).isEqualTo(PricePosition.REFERENCE_UNAVAILABLE);
        assertThat(assessment.referenceConfidence()).isEqualTo(MarketReferenceConfidence.UNAVAILABLE);
        assertThat(assessment.referenceGap()).isEqualTo(ReferenceGap.NO_COMPARABLE_SHAPE);
        // Et pas de "prix nettement en dessous" tire d'une reference inexistante.
        assertThat(assessment.trust().signals()).doesNotContain(TrustSignal.PRICE_FAR_BELOW_REFERENCE);
        // « Aucune donnee » et « des relevés, mais aucun comparable » ne se disent
        // pas pareil : les trois relevés existent, c'est leur FORME qui ne
        // correspond pas. L'écran a besoin du compte pour le dire.
        assertThat(assessment.referenceExaminedCount()).isEqualTo(3);
        assertThat(assessment.referenceSampleSize()).isZero();
    }

    /**
     * Un prix de référence ne se relit pas seul : ce qui permet de le
     * <i>discuter</i> - combien de comparables, à quel point ils s'accordent, de
     * quand date le plus récent - doit être figé DANS l'analyse. Ces trois
     * réserves existaient déjà dans {@link MarketReference}, mais s'arrêtaient au
     * calcul : l'écran affichait « confiance bonne » à croire sur parole.
     */
    @Test
    void les_reserves_de_la_reference_sont_figees_avec_le_prix() {
        MangaEdition edition = MangaEdition.create("Vagabond", "Standard", EditionTier.STANDARD, "Tonkam",
                37, new BigDecimal("7.60"), false, false, null);
        LocalDate plusRecent = LocalDate.now().minusDays(9);
        // Trois lots de 10 tomes a 4,50 / 5,00 / 5,50 EUR le tome : mediane 5,00,
        // dispersion (5,50 - 4,50) / 5,00 = 20 %.
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

    /** Un lot de {@code tomes} tomes a partir du tome 1, releve il y a deux mois. */
    private static MarketPriceObservation observation(MangaEdition edition, int tomes, String prix) {
        return MarketPriceObservation.record_(edition.id(), new VolumeRange(1, tomes), new BigDecimal(prix),
                ListingPlatform.VINTED, Condition.VERY_GOOD, LocalDate.now().minusMonths(2), null);
    }
}
