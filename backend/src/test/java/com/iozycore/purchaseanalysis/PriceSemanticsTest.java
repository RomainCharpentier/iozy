package com.iozycore.purchaseanalysis;

import com.iozycore.listing.ShippingEstimateKind;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

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
                listing.askingPrice(), medianeComparable, ConfidenceLevel.HIGH);
        // Comparé sur le coût d'acquisition, ce serait 14,03 contre 12 : « cher ».
        PricePosition surCoutAcquisition = DealAssessmentPolicy.positionOf(
                listing.totalRealCost(), medianeComparable, ConfidenceLevel.HIGH);

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
        Listing sansNature = new Listing(UUID.randomUUID(), ListingPlatform.VINTED, null, "Lot", null,
                new BigDecimal("10"), null, null, new BigDecimal("1.20"), Condition.VERY_GOOD, false,
                List.of(new ListingItem(new MangaSeries("Une serie", null), "Standard", java.util.Set.of(1), null)),
                List.of(), Instant.now());

        assertThat(sansNature.shippingKind()).isEqualTo(ShippingEstimateKind.UNKNOWN);
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
}
