package com.iozycore.manga.deals;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Les points à vérifier sur une annonce.
 * <p>
 * Ces tests vérifient des <b>signaux</b>, jamais un score : il n'y a pas de
 * « confiance 94/100 » à assert, parce qu'il n'y en a pas à produire. Et le
 * test le plus important est
 * {@link #un_prix_tres_bas_appelle_la_vigilance_sans_condamner_l_annonce()} :
 * une excellente affaire existe réellement, et la confondre avec une arnaque
 * ferait passer à côté.
 */
class ListingTrustAssessmentTest {

    private static final String DESCRIPTION_NORMALE =
            "Série complète en très bon état, lue une seule fois, jamais prêtée, stockée à l'abri de la lumière.";

    @Test
    void une_annonce_soignee_ne_leve_aucun_signal() {
        ListingTrustAssessment trust = ListingTrustAssessment.assess(
                DESCRIPTION_NORMALE, 6, new BigDecimal("70"), new BigDecimal("75"));

        assertThat(trust.signals()).isEmpty();
        assertThat(trust.level()).isEqualTo(TrustLevel.NO_OBVIOUS_SIGNAL);
    }

    @Test
    void aucune_photo_est_un_signal_fort() {
        ListingTrustAssessment trust = ListingTrustAssessment.assess(
                DESCRIPTION_NORMALE, 0, new BigDecimal("70"), new BigDecimal("75"));

        assertThat(trust.signals()).contains(TrustSignal.NO_PHOTO);
        assertThat(trust.level()).isEqualTo(TrustLevel.EXAMINE_CAREFULLY);
    }

    @Test
    void une_ou_deux_photos_est_un_signal_modere() {
        assertThat(ListingTrustAssessment.assess(DESCRIPTION_NORMALE, 2, new BigDecimal("70"), new BigDecimal("75"))
                .signals()).contains(TrustSignal.VERY_FEW_PHOTOS);
    }

    @Test
    void beaucoup_de_photos_ne_donne_aucun_bonus() {
        ListingTrustAssessment trust = ListingTrustAssessment.assess(
                DESCRIPTION_NORMALE, 20, new BigDecimal("70"), new BigDecimal("75"));

        // Vingt photos ne prouvent rien. Transformer l'abondance en gage de
        // sérieux serait exactement le raccourci qu'un vendeur malintentionné
        // exploite.
        assertThat(trust.signals()).isEmpty();
        assertThat(trust.level()).isEqualTo(TrustLevel.NO_OBVIOUS_SIGNAL);
    }

    @Test
    void une_description_absente_ou_tres_courte_est_signalee() {
        assertThat(ListingTrustAssessment.assess(null, 6, new BigDecimal("70"), new BigDecimal("75")).signals())
                .contains(TrustSignal.SHORT_DESCRIPTION);
        assertThat(ListingTrustAssessment.assess("lot manga", 6, new BigDecimal("70"), new BigDecimal("75")).signals())
                .contains(TrustSignal.SHORT_DESCRIPTION);
    }

    @Test
    void une_longue_description_n_est_pas_une_garantie() {
        // Elle retire seulement le signal « description courte ». Elle n'ajoute
        // aucun crédit : la longueur n'est pas de l'honnêteté.
        ListingTrustAssessment trust = ListingTrustAssessment.assess(
                DESCRIPTION_NORMALE, 1, new BigDecimal("70"), new BigDecimal("75"));

        assertThat(trust.signals()).containsExactly(TrustSignal.VERY_FEW_PHOTOS);
    }

    @Test
    void une_proposition_de_paiement_hors_plateforme_est_un_signal_fort() {
        for (String texte : new String[] {
                "Envoi rapide, paiement par PayPal entre amis de préférence merci beaucoup",
                "Contacte-moi sur WhatsApp pour aller plus vite, je réponds tout de suite",
                "Je préfère un virement bancaire direct, ça évite les frais de la plateforme",
                "Disponible aussi sur Telegram si tu veux plus de photos de ce joli lot",
        }) {
            assertThat(ListingTrustAssessment.assess(texte, 6, new BigDecimal("70"), new BigDecimal("75")).signals())
                    .as(texte)
                    .contains(TrustSignal.OFF_PLATFORM_PAYMENT_MENTION);
        }
    }

    @Test
    void un_prix_tres_bas_appelle_la_vigilance_sans_condamner_l_annonce() {
        // 20 € contre une référence de 75 € : très en dessous.
        ListingTrustAssessment trust = ListingTrustAssessment.assess(
                DESCRIPTION_NORMALE, 6, new BigDecimal("20"), new BigDecimal("75"));

        assertThat(trust.signals()).containsExactly(TrustSignal.PRICE_FAR_BELOW_REFERENCE);
        // Un signal modéré, pas un verdict de fraude - et surtout, le prix reste
        // évalué comme une très bonne affaire de son côté.
        assertThat(trust.level()).isEqualTo(TrustLevel.A_FEW_THINGS_TO_CHECK);
        assertThat(DealAssessmentPolicy.positionOf(new BigDecimal("20"), new BigDecimal("75"), MarketReferenceConfidence.HIGH))
                .isEqualTo(PricePosition.VERY_GOOD_PRICE);
    }

    @Test
    void sans_reference_marche_aucun_jugement_sur_le_prix_n_est_porte() {
        ListingTrustAssessment trust = ListingTrustAssessment.assess(
                DESCRIPTION_NORMALE, 6, new BigDecimal("5"), null);

        // 5 € est peut-être dérisoire, mais sans référence on ne sait pas
        // par rapport à quoi.
        assertThat(trust.signals()).doesNotContain(TrustSignal.PRICE_FAR_BELOW_REFERENCE);
    }

    @Test
    void deux_signaux_forts_font_basculer_en_preoccupant() {
        ListingTrustAssessment trust = ListingTrustAssessment.assess(
                "virement uniquement", 0, new BigDecimal("70"), new BigDecimal("75"));

        assertThat(trust.signals())
                .contains(TrustSignal.NO_PHOTO, TrustSignal.OFF_PLATFORM_PAYMENT_MENTION);
        assertThat(trust.level()).isEqualTo(TrustLevel.CONCERNING);
    }

    @Test
    void les_signaux_les_plus_graves_arrivent_en_premier() {
        ListingTrustAssessment trust = ListingTrustAssessment.assess(
                "paypal", 2, new BigDecimal("70"), new BigDecimal("75"));

        // L'ordre porte du sens à l'écran : ce qui compte le plus se lit d'abord.
        assertThat(trust.signals().get(0).severity()).isEqualTo(TrustSignalSeverity.HIGH);
    }
}
