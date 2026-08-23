package com.iozycore.purchaseanalysis;

import com.iozycore.domain.catalog.EditionTier;
import com.iozycore.domain.catalog.MangaEdition;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * <b>Deux offres ne sont comparables que si c'est le même produit.</b>
 *
 * <h2>Le défaut que ces tests interdisent</h2>
 * Tout relevé rattaché à l'édition entrait dans la médiane, ramené à un prix au
 * tome. Un tome dépareillé se vend proche du neuf ; une intégrale se brade.
 * Mélanger les deux donne un chiffre précis, présenté comme sûr dès trois
 * relevés, et faux.
 * <p>
 * Le cas nommé dans le cahier des charges - <i>Platinum End 1-14</i> face à un
 * T.1, un lot 1-4 et un lot 7-10 - est vérifié ici deux fois : la sélection ne
 * retient rien, et la référence qui en découle est UNAVAILABLE plutôt qu'un
 * faux prix marché.
 */
class MarketReferenceTest {

    private static final LocalDate AUJOURD_HUI = LocalDate.of(2026, 8, 23);

    /**
     * Une édition plus longue que le lot évalué : un lot de 14 y est un LOT
     * PARTIEL. Sur Platinum End (14 tomes en tout), 1-14 est au contraire
     * l'intégrale - c'est justement la distinction que ces règles portent, et
     * elle change le jeu de comparables retenu.
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

    // ============================================ LE test : Platinum End 1-14

    @Test
    void un_lot_de_14_ne_se_compare_ni_a_un_tome_seul_ni_a_des_lots_de_4() {
        MangaEdition edition = platinumEnd(14);
        List<MarketPriceObservation> releves = List.of(
                releve(edition, 1, 1, "8.00"),    // T.1 seul      -> 8,00 / tome
                releve(edition, 1, 4, "20.00"),   // lot de 4      -> 5,00 / tome
                releve(edition, 7, 10, "18.00")); // lot de 4      -> 4,50 / tome

        MarketComparableSelector.Selection selection =
                MarketComparableSelector.selectFor(edition, 14, releves, AUJOURD_HUI);

        // Le T.1 sort par la FORME (tome seul contre lot), les deux lots de 4
        // par la TAILLE (4 x 2 = 8 < 14, plus du simple au double).
        assertThat(selection.retained()).isEmpty();
        assertThat(selection.examined()).isEqualTo(3);
        assertThat(selection.gap()).isEqualTo(ReferenceGap.NO_COMPARABLE_SHAPE);

        MarketReference reference = referencePour(edition, 14, releves);

        // L'ancien calcul : médiane 5,00 / tome, HIGH parce que « trois
        // relevés », donc 70 EUR presentés comme solides. Plus jamais.
        assertThat(reference.price()).isNull();
        assertThat(reference.confidence()).isEqualTo(MarketReferenceConfidence.UNAVAILABLE);
        assertThat(reference.isUsable()).isFalse();
        assertThat(reference.source()).isEqualTo(MarketReferenceSource.NONE);
        // On sait dire que des relevés EXISTENT : « aucune donnée » serait faux,
        // et l'écran doit pouvoir conseiller quel relevé ajouter.
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

        // 60 EUR se serait dit « bon prix » face aux 70 EUR inventés.
        assertThat(DealAssessmentPolicy.positionOf(new BigDecimal("60"), reference))
                .isEqualTo(PricePosition.REFERENCE_UNAVAILABLE);
    }

    @Test
    void des_lots_de_taille_voisine_restent_comparables_eux() {
        MangaEdition edition = serieLongue();
        // 10, 12 et 13 tomes face a 14 : le meme produit, a peu de choses pres.
        MarketReference reference = referencePour(edition, 14, List.of(
                releve(edition, 1, 10, "40.00"),  // 4,00 / tome
                releve(edition, 1, 12, "51.00"),  // 4,25 / tome
                releve(edition, 2, 14, "58.50"))); // 4,50 / tome

        assertThat(reference.sampleSize()).isEqualTo(3);
        assertThat(reference.comparedShape()).isEqualTo(LotShape.PARTIAL_LOT);
        // Mediane 4,25 / tome x 14 tomes.
        assertThat(reference.price()).isEqualByComparingTo("59.50");
        assertThat(reference.confidence()).isEqualTo(MarketReferenceConfidence.HIGH);
        assertThat(reference.source()).isEqualTo(MarketReferenceSource.OBSERVED_COMPARABLES);
        // Dispersion faible : 0,50 d'amplitude sur une mediane de 4,25 = 12 %.
        assertThat(reference.spreadPercent()).isEqualTo(12);
    }

    // ================================================ Les formes, une par une

    @Test
    void un_tome_seul_ne_se_compare_qu_a_des_tomes_seuls() {
        MangaEdition edition = platinumEnd(14);
        MarketReference reference = referencePour(edition, 1, List.of(
                releve(edition, 3, 3, "7.00"),
                releve(edition, 9, 9, "8.00"),
                releve(edition, 1, 10, "40.00")));  // ecarte : ce n'est pas un tome seul

        assertThat(reference.sampleSize()).isEqualTo(2);
        assertThat(reference.comparedShape()).isEqualTo(LotShape.SINGLE_VOLUME);
        assertThat(reference.price()).isEqualByComparingTo("7.50");
        // Le lot de 10 aurait tire la reference a 4,00 EUR le tome, soit 47 %
        // trop bas pour un tome depareille.
        assertThat(reference.confidence()).isEqualTo(MarketReferenceConfidence.MEDIUM);
    }

    @Test
    void une_integrale_ne_se_compare_qu_a_des_integrales() {
        MangaEdition edition = platinumEnd(14);
        MarketReference reference = referencePour(edition, 14, List.of(
                releve(edition, 1, 14, "56.00"),
                releve(edition, null, null, "60.00"),  // relevé « sur l'édition entière »
                releve(edition, 1, 12, "51.00")));     // lot partiel : ecarte

        assertThat(reference.sampleSize()).isEqualTo(2);
        assertThat(reference.comparedShape()).isEqualTo(LotShape.COMPLETE_SET);
        // 56/14 = 4,00 et 60/14 = 4,29 le tome ; médiane 4,15 x 14.
        assertThat(reference.price()).isEqualByComparingTo("58.10");
    }

    @Test
    void une_edition_dont_on_ignore_le_nombre_de_tomes_plafonne_la_confiance() {
        // Sans total, impossible d'affirmer qu'un lot de 14 n'est pas l'integrale :
        // les comparables restent utilisables, la certitude non.
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

        // Combien de tomes valent ces 60 EUR ? On l'ignore, donc on ne divise pas.
        assertThat(reference.confidence()).isEqualTo(MarketReferenceConfidence.UNAVAILABLE);
        assertThat(reference.gap()).isEqualTo(ReferenceGap.NO_COMPARABLE_SHAPE);
    }

    // ============================================ Echantillon, age, dispersion

    @Test
    void un_seul_comparable_ne_suffit_jamais_a_positionner_un_prix() {
        MangaEdition edition = serieLongue();
        MarketReference reference = referencePour(edition, 14, List.of(releve(edition, 1, 12, "51.00")));

        assertThat(reference.sampleSize()).isEqualTo(1);
        assertThat(reference.confidence()).isEqualTo(MarketReferenceConfidence.LOW);
        assertThat(reference.isUsable()).isFalse();
        // Le prix existe, il n'est simplement pas assez sûr pour trancher.
        assertThat(reference.price()).isEqualByComparingTo("59.50");
        assertThat(DealAssessmentPolicy.positionOf(new BigDecimal("40"), reference))
                .isEqualTo(PricePosition.REFERENCE_UNAVAILABLE);
    }

    @Test
    void des_comparables_qui_se_contredisent_font_baisser_la_confiance() {
        MangaEdition edition = serieLongue();
        MarketReference reference = referencePour(edition, 14, List.of(
                releve(edition, 1, 12, "24.00"),   // 2,00 / tome
                releve(edition, 1, 12, "51.00"),   // 4,25 / tome
                releve(edition, 1, 12, "84.00"))); // 7,00 / tome

        // Trois comparables de forme et taille identiques, mais du simple au
        // triple : la mediane ne decrit plus rien de stable.
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
        // La raison est precise : ce ne sont pas de mauvais comparables, ce sont
        // de vieux comparables. L'ecran peut le dire, et l'utilisateur agir.
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

    // ================================================ Absences bien distinguées

    @Test
    void une_edition_absente_du_catalogue_se_dit_autrement_qu_une_edition_sans_releve() {
        MarketReference sansEdition = MarketReference.fromComparables(null, 14,
                MarketComparableSelector.selectFor(null, 14, List.of(), AUJOURD_HUI), AUJOURD_HUI);
        MangaEdition edition = platinumEnd(14);
        MarketReference sansReleve = referencePour(edition, 14, List.of());

        assertThat(sansEdition.gap()).isEqualTo(ReferenceGap.EDITION_NOT_IN_CATALOGUE);
        assertThat(sansReleve.gap()).isEqualTo(ReferenceGap.NO_OBSERVATION);
        // Deux causes, deux conseils : « complète la fiche » contre « relève un prix ».
        assertThat(sansEdition.gap()).isNotEqualTo(sansReleve.gap());
    }

    // ========================================================= Lots multi-séries

    @Test
    void un_lot_multi_series_dont_une_serie_manque_n_a_pas_de_reference() {
        MangaEdition edition = serieLongue();
        MarketReference connue = referencePour(edition, 14, List.of(
                releve(edition, 1, 12, "51.00"),
                releve(edition, 1, 10, "40.00"),
                releve(edition, 2, 14, "58.50")));
        MarketReference inconnue = MarketReference.unavailable(ReferenceGap.NO_OBSERVATION, 0);

        MarketReference lot = MarketReference.sum(List.of(connue, inconnue));

        // Sommer la seule serie connue donnerait une reference trop basse, donc
        // un lot systematiquement « trop cher ».
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

        // Juxtaposer deux references unitaires pour juger un lot reste une
        // approximation, meme quand chaque terme est solide.
        assertThat(lot.price()).isEqualByComparingTo("119.00");
        assertThat(lot.confidence()).isEqualTo(MarketReferenceConfidence.MEDIUM);
        // L'echantillon annonce est celui du maillon faible, pas la somme.
        assertThat(lot.sampleSize()).isEqualTo(3);
    }

    @Test
    void une_serie_seule_conserve_sa_confiance_faible_au_lieu_de_devenir_une_absence() {
        MangaEdition edition = serieLongue();
        MarketReference faible = referencePour(edition, 14, List.of(releve(edition, 1, 12, "51.00")));

        MarketReference lot = MarketReference.sum(List.of(faible));

        // LOW n'est pas UNAVAILABLE : le prix ne se positionne pas, mais l'ecran
        // peut dire « un seul comparable » plutot que « aucune donnee », ce qui
        // est faux et n'aide personne.
        assertThat(lot.confidence()).isEqualTo(MarketReferenceConfidence.LOW);
        assertThat(lot.sampleSize()).isEqualTo(1);
        assertThat(lot.gap()).isEqualTo(ReferenceGap.NONE);
        assertThat(lot.isUsable()).isFalse();
    }

    @Test
    void une_reference_sans_prix_ne_peut_pas_pretendre_positionner() {
        // Le garde-fou structurel : la combinaison est refusee a la construction.
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
