package com.iozycore.purchaseanalysis;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Ce qu'un lot apporte à une collection précise.
 * <p>
 * Le test qui compte le plus est {@link #le_prix_par_element_utile_est_plus_eleve_que_le_prix_par_element()} :
 * c'est la seule métrique qu'aucun comparateur de prix ne peut produire, et
 * celle qui change la décision. Un lot à 70 € pour 14 tomes affiche 5 € le tome
 * — mais si 4 sont des doublons, il coûte réellement 7 € le tome qui sert.
 */
class CollectionFitTest {

    @Test
    void un_lot_entierement_neuf_pour_moi_est_tres_utile() {
        CollectionFit fit = CollectionFit.of(10, 0, 0, new BigDecimal("50.00"));

        assertThat(fit.detectedItemCount()).isEqualTo(10);
        assertThat(fit.missingItemCount()).isEqualTo(10);
        assertThat(fit.usefulItemCount()).isEqualTo(10);
        assertThat(fit.interest()).isEqualTo(CollectionFit.CollectionInterest.HIGHLY_USEFUL);
        // Sans doublon, les deux prix coïncident.
        assertThat(fit.pricePerItem()).isEqualByComparingTo("5.00");
        assertThat(fit.pricePerUsefulItem()).isEqualByComparingTo("5.00");
    }

    @Test
    void le_prix_par_element_utile_est_plus_eleve_que_le_prix_par_element() {
        // 10 tomes à 50 €, dont 2 déjà possédés.
        CollectionFit fit = CollectionFit.of(10, 2, 0, new BigDecimal("50.00"));

        assertThat(fit.pricePerItem()).isEqualByComparingTo("5.00");
        // 50 / 8 : c'est ce chiffre-là qui décide, pas le premier.
        assertThat(fit.pricePerUsefulItem()).isEqualByComparingTo("6.25");
        assertThat(fit.interest()).isEqualTo(CollectionFit.CollectionInterest.HIGHLY_USEFUL);
    }

    @Test
    void beaucoup_de_doublons_font_chuter_l_interet() {
        CollectionFit fit = CollectionFit.of(10, 7, 0, new BigDecimal("50.00"));

        assertThat(fit.usefulItemCount()).isEqualTo(3);
        assertThat(fit.interest()).isEqualTo(CollectionFit.CollectionInterest.MOSTLY_DUPLICATES);
        // Le prix par tome utile explose : 50 / 3.
        assertThat(fit.pricePerUsefulItem()).isEqualByComparingTo("16.67");
    }

    @Test
    void un_lot_entierement_possede_n_apporte_rien_et_n_a_pas_de_prix_utile() {
        CollectionFit fit = CollectionFit.of(10, 10, 0, new BigDecimal("50.00"));

        assertThat(fit.usefulItemCount()).isZero();
        assertThat(fit.interest()).isEqualTo(CollectionFit.CollectionInterest.NOTHING_NEW);
        assertThat(fit.bringsNothing()).isTrue();
        // Pas de division par zéro, et surtout pas de « 0 € le tome utile »
        // qui ferait passer un lot inutile pour une aubaine.
        assertThat(fit.pricePerUsefulItem()).isNull();
        assertThat(fit.pricePerItem()).isEqualByComparingTo("5.00");
    }

    @Test
    void les_envies_sont_comptees_sans_changer_le_nombre_de_manquants() {
        CollectionFit fit = CollectionFit.of(10, 2, 5, new BigDecimal("50.00"));

        // Vouloir n'est pas posséder : les envies qualifient l'intérêt des
        // manquants, elles n'en retirent ni n'en ajoutent aucun.
        assertThat(fit.missingItemCount()).isEqualTo(8);
        assertThat(fit.usefulItemCount()).isEqualTo(8);
        assertThat(fit.wishlistedItemCount()).isEqualTo(5);
    }

    @Test
    void les_envies_ne_peuvent_pas_depasser_les_manquants() {
        // Garde-fou : un compte d'envies incohérent ne doit pas produire
        // « 9 souhaités sur 3 manquants » à l'écran.
        CollectionFit fit = CollectionFit.of(10, 7, 9, new BigDecimal("50.00"));

        assertThat(fit.wishlistedItemCount()).isEqualTo(3);
    }

    @Test
    void sans_element_identifie_la_dimension_se_tait() {
        CollectionFit fit = CollectionFit.of(0, 0, 0, new BigDecimal("50.00"));

        assertThat(fit.interest()).isEqualTo(CollectionFit.CollectionInterest.UNKNOWN);
        assertThat(fit.isKnown()).isFalse();
        // Rien n'est inventé : ni prix par élément, ni intérêt.
        assertThat(fit.pricePerItem()).isNull();
        assertThat(fit.pricePerUsefulItem()).isNull();
    }

    @Test
    void un_cout_inconnu_n_empeche_pas_de_juger_l_interet() {
        CollectionFit fit = CollectionFit.of(10, 3, 0, null);

        assertThat(fit.usefulItemCount()).isEqualTo(7);
        assertThat(fit.interest()).isEqualTo(CollectionFit.CollectionInterest.PARTIALLY_USEFUL);
        assertThat(fit.pricePerItem()).isNull();
        assertThat(fit.pricePerUsefulItem()).isNull();
    }
}
