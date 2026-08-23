package com.iozycore.purchaseanalysis;

import com.iozycore.domain.catalog.EditionTier;
import com.iozycore.domain.catalog.MangaEdition;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * <b>Un échantillon compte des vendeurs, pas des lignes en base.</b>
 *
 * <h2>Le défaut que ces tests interdisent</h2>
 * Une même annonce analysée cinq fois produit cinq relevés. Si chacun comptait,
 * il suffirait de recharger une page pour faire passer une référence à HIGH sur
 * une seule offre : un chiffre précis tiré d'une observation unique du marché,
 * exactement ce que la confiance est censée empêcher.
 * <p>
 * Et une annonce ne se compare pas à elle-même : dès la deuxième analyse d'une
 * URL, son propre prix serait dans l'échantillon, et toute annonce se dirait
 * « au prix du marché » - le sien.
 */
class MarketObservationIndependenceTest {

    private static final LocalDate AUJOURD_HUI = LocalDate.of(2026, 8, 23);

    private static MangaEdition edition() {
        return MangaEdition.create("Berserk", "Standard", EditionTier.STANDARD, "Glenat",
                20, new BigDecimal("8.50"), false, false, null);
    }

    /** Un relevé issu d'une annonce, avec son identité et son ancienneté d'écriture. */
    private static MarketPriceObservation depuisAnnonce(MangaEdition edition, String identite, String prix,
                                                         LocalDate date, int ordreEcriture) {
        return new MarketPriceObservation(java.util.UUID.randomUUID(), edition.id(), new VolumeRange(1, 12),
                new BigDecimal(prix), ListingPlatform.VINTED, Condition.VERY_GOOD, date, null,
                Instant.parse("2026-08-01T10:00:00Z").plusSeconds(ordreEcriture), // départage à date égale
                MarketObservationOrigin.LISTING_ANALYSIS, 12, identite, "https://www.vinted.fr/items/" + identite);
    }

    private static MarketReference referencePour(MangaEdition edition, List<MarketPriceObservation> releves,
                                                  String annonceCourante) {
        return MarketReference.fromComparables(edition, 14,
                MarketComparableSelector.selectFor(edition, 14, releves, AUJOURD_HUI, annonceCourante), AUJOURD_HUI);
    }

    // =============================================== B, C : une annonce suivie

    @Test
    void trois_releves_de_la_meme_annonce_ne_font_qu_un_comparable() {
        MangaEdition edition = edition();
        List<MarketPriceObservation> releves = List.of(
                depuisAnnonce(edition, "VINTED:A", "70.00", AUJOURD_HUI.minusDays(6), 1),
                depuisAnnonce(edition, "VINTED:A", "65.00", AUJOURD_HUI.minusDays(3), 2),
                depuisAnnonce(edition, "VINTED:A", "60.00", AUJOURD_HUI.minusDays(1), 3));

        MarketReference reference = referencePour(edition, releves, null);

        // L'historique existe - trois relevés - mais il décrit UNE offre.
        assertThat(reference.temporalCount()).isEqualTo(3);
        assertThat(reference.sampleSize()).isEqualTo(1);
        // Et donc jamais HIGH : c'est tout l'enjeu.
        assertThat(reference.confidence()).isEqualTo(MarketReferenceConfidence.LOW);
        assertThat(reference.isUsable()).isFalse();
    }

    @Test
    void le_prix_retenu_pour_une_annonce_suivie_est_le_plus_recent() {
        MangaEdition edition = edition();
        // Volontairement dans le désordre : c'est la DATE qui tranche, pas l'ordre.
        List<MarketPriceObservation> releves = List.of(
                depuisAnnonce(edition, "VINTED:A", "60.00", AUJOURD_HUI.minusDays(1), 3),
                depuisAnnonce(edition, "VINTED:A", "70.00", AUJOURD_HUI.minusDays(6), 1));

        MarketReference reference = referencePour(edition, releves, null);

        // 60 / 12 tomes = 5,00 le tome, x 14 tomes visés = 70,00.
        // Le prix d'hier decrit cette offre ; celui d'il y a six jours ne la
        // decrit plus.
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

    // ================================================ D : trois vraies annonces

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

    // ============================================ E : l'annonce courante exclue

    @Test
    void une_annonce_ne_se_compare_jamais_a_elle_meme() {
        MangaEdition edition = edition();
        List<MarketPriceObservation> releves = List.of(
                depuisAnnonce(edition, "VINTED:A", "42.00", AUJOURD_HUI.minusDays(9), 1),
                depuisAnnonce(edition, "VINTED:B", "45.00", AUJOURD_HUI.minusDays(7), 2),
                depuisAnnonce(edition, "VINTED:C", "96.00", AUJOURD_HUI.minusDays(1), 3));

        // On réévalue C : son propre prix, très au-dessus, ne doit pas tirer la
        // référence vers lui et le faire passer pour « au prix du marché ».
        MarketReference sansSoi = referencePour(edition, releves, "VINTED:C");
        MarketReference avecSoi = referencePour(edition, releves, null);

        assertThat(sansSoi.sampleSize()).isEqualTo(2);
        // 42/12 = 3,50 et 45/12 = 3,75 -> médiane 3,63 x 14 = 50,82.
        assertThat(sansSoi.price()).isEqualByComparingTo("50.82");
        // Avec elle-même : 3,50 / 3,75 / 8,00 -> médiane 3,75 x 14 = 52,50, et
        // surtout un échantillon gonflé d'une offre qui n'en est pas une.
        assertThat(avecSoi.sampleSize()).isEqualTo(3);
        assertThat(avecSoi.price()).isNotEqualByComparingTo(sansSoi.price());
    }

    @Test
    void exclure_l_annonce_courante_peut_rendre_la_reference_indisponible_et_c_est_correct() {
        MangaEdition edition = edition();
        // Le seul comparable EST l'annonce évaluée : il ne reste rien.
        List<MarketPriceObservation> releves = List.of(
                depuisAnnonce(edition, "VINTED:C", "96.00", AUJOURD_HUI.minusDays(1), 1));

        MarketReference reference = referencePour(edition, releves, "VINTED:C");

        assertThat(reference.confidence()).isEqualTo(MarketReferenceConfidence.UNAVAILABLE);
        // Mieux vaut « aucune référence » qu'une référence égale au prix demandé.
        assertThat(reference.price()).isNull();
        // Et l'absence est nommée pour ce qu'elle est : il manque une AUTRE
        // offre, pas un relevé de plus sur celle-ci.
        assertThat(reference.gap()).isEqualTo(ReferenceGap.ONLY_CURRENT_LISTING);
    }

    // ========================================== J : les relevés manuels intacts

    @Test
    void deux_releves_manuels_restent_deux_comparables() {
        MangaEdition edition = edition();
        // Sans annonce derrière, rien ne permet - ni ne justifie - de les fondre :
        // l'utilisateur a vu deux prix et en a noté deux.
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

        // Les deux origines valent autant : ce sont des prix vus.
        assertThat(reference.sampleSize()).isEqualTo(3);
        assertThat(reference.confidence()).isEqualTo(MarketReferenceConfidence.HIGH);
    }

    // ============================================== L'identité, cas par cas

    @Test
    void l_identifiant_de_source_prime_sur_l_url() {
        // Deux liens vers la même annonce, l'un avec le slug du titre : même id,
        // donc une seule offre.
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
        // Assumé et documenté : deux saisies manuelles sont deux comparables.
        assertThat(ListingIdentity.of(ListingPlatform.VINTED, null, null)).isNull();
        assertThat(ListingIdentity.of(ListingPlatform.VINTED, "  ", "   ")).isNull();
        assertThat(ListingIdentity.of(ListingPlatform.VINTED, null, "pas une url")).isNull();
    }
}
