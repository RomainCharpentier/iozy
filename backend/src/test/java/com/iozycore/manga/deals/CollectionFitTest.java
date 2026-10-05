package com.iozycore.manga.deals;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * What a batch brings to a specific collection.
 * <p>
 * The most important test is {@link #le_prix_par_element_utile_est_plus_eleve_que_le_prix_par_element()}:
 * it is the only metric that no price comparator can produce, and
 * the one that changes the decision. A batch at 70 EUR for 14 volumes shows 5 EUR a volume
 * — but if 4 are duplicates, it really costs 7 EUR per useful volume.
 */
class CollectionFitTest {

    @Test
    void un_lot_entierement_neuf_pour_moi_est_tres_utile() {
        CollectionFit fit = CollectionFit.of(10, 0, 0, new BigDecimal("50.00"));

        assertThat(fit.detectedItemCount()).isEqualTo(10);
        assertThat(fit.missingItemCount()).isEqualTo(10);
        assertThat(fit.usefulItemCount()).isEqualTo(10);
        assertThat(fit.interest()).isEqualTo(CollectionFit.CollectionInterest.HIGHLY_USEFUL);
        // Without duplicates, the two prices are the same.
        assertThat(fit.pricePerItem()).isEqualByComparingTo("5.00");
        assertThat(fit.pricePerUsefulItem()).isEqualByComparingTo("5.00");
    }

    @Test
    void le_prix_par_element_utile_est_plus_eleve_que_le_prix_par_element() {
        // 10 volumes at 50 EUR, 2 of them already owned.
        CollectionFit fit = CollectionFit.of(10, 2, 0, new BigDecimal("50.00"));

        assertThat(fit.pricePerItem()).isEqualByComparingTo("5.00");
        // 50 / 8: this is the figure that decides, not the first one.
        assertThat(fit.pricePerUsefulItem()).isEqualByComparingTo("6.25");
        assertThat(fit.interest()).isEqualTo(CollectionFit.CollectionInterest.HIGHLY_USEFUL);
    }

    @Test
    void beaucoup_de_doublons_font_chuter_l_interet() {
        CollectionFit fit = CollectionFit.of(10, 7, 0, new BigDecimal("50.00"));

        assertThat(fit.usefulItemCount()).isEqualTo(3);
        assertThat(fit.interest()).isEqualTo(CollectionFit.CollectionInterest.MOSTLY_DUPLICATES);
        // The price per useful volume explodes: 50 / 3.
        assertThat(fit.pricePerUsefulItem()).isEqualByComparingTo("16.67");
    }

    @Test
    void un_lot_entierement_possede_n_apporte_rien_et_n_a_pas_de_prix_utile() {
        CollectionFit fit = CollectionFit.of(10, 10, 0, new BigDecimal("50.00"));

        assertThat(fit.usefulItemCount()).isZero();
        assertThat(fit.interest()).isEqualTo(CollectionFit.CollectionInterest.NOTHING_NEW);
        assertThat(fit.bringsNothing()).isTrue();
        // No division by zero, and above all no "0 EUR per useful volume"
        // that would make a useless batch look like a bargain.
        assertThat(fit.pricePerUsefulItem()).isNull();
        assertThat(fit.pricePerItem()).isEqualByComparingTo("5.00");
    }

    @Test
    void les_envies_sont_comptees_sans_changer_le_nombre_de_manquants() {
        CollectionFit fit = CollectionFit.of(10, 2, 5, new BigDecimal("50.00"));

        // Wanting is not owning: wishes qualify the interest in the
        // missing ones, they neither remove nor add any.
        assertThat(fit.missingItemCount()).isEqualTo(8);
        assertThat(fit.usefulItemCount()).isEqualTo(8);
        assertThat(fit.wishlistedItemCount()).isEqualTo(5);
    }

    @Test
    void les_envies_ne_peuvent_pas_depasser_les_manquants() {
        // Safeguard: an inconsistent wish count must not produce
        // "9 wished out of 3 missing" on screen.
        CollectionFit fit = CollectionFit.of(10, 7, 9, new BigDecimal("50.00"));

        assertThat(fit.wishlistedItemCount()).isEqualTo(3);
    }

    @Test
    void sans_element_identifie_la_dimension_se_tait() {
        CollectionFit fit = CollectionFit.of(0, 0, 0, new BigDecimal("50.00"));

        assertThat(fit.interest()).isEqualTo(CollectionFit.CollectionInterest.UNKNOWN);
        assertThat(fit.isKnown()).isFalse();
        // Nothing is invented: no price per item, no interest.
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
