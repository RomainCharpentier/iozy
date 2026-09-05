package com.iozycore.integration;

import com.iozycore.manga.domain.EditionTier;
import com.iozycore.manga.domain.MangaEdition;
import com.iozycore.manga.domain.MangaEditionRepository;
import com.iozycore.core.listing.ShippingEstimateKind;
import com.iozycore.manga.deals.Condition;
import com.iozycore.core.listing.ListingPlatform;
import com.iozycore.manga.deals.MarketObservationOrigin;
import com.iozycore.manga.deals.MarketPriceObservation;
import com.iozycore.manga.deals.PurchaseAnalysis;
import com.iozycore.manga.deals.PurchaseAnalysisService;
import com.iozycore.manga.deals.PurchaseAnalysisService.AnalyzeListingCommand;
import com.iozycore.manga.deals.PurchaseAnalysisService.AnalyzeListingItemCommand;
import com.iozycore.manga.deals.VolumeRange;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import com.iozycore.manga.deals.ReferenceGap;

/**
 * <b>L'usage normal d'IozyCore doit nourrir les prix relevés - sans jamais
 * fabriquer d'échantillon.</b>
 *
 * <h2>Ce qui est vérifié ici, et pas ailleurs</h2>
 * Les règles d'indépendance se testent en domaine pur. Ce qui demande une vraie
 * base, c'est le <b>déclenchement</b> : quelle analyse crée un relevé, laquelle
 * n'en crée pas, et ce que la ligne contient réellement une fois relue depuis
 * PostgreSQL - notamment que le prix enregistré est celui de l'annonce et non
 * le coût d'acquisition.
 */
class MarketObservationIngestionIntegrationTest extends PostgresIntegrationTest {

    @Autowired
    private PurchaseAnalysisService service;

    @Autowired
    private MangaEditionRepository mangaEditionRepository;

    private MangaEdition uneEdition(Integer totalTomes) {
        return mangaEditionRepository.save(MangaEdition.create(
                "Platinum End " + UUID.randomUUID(), "Standard", EditionTier.STANDARD, "Kaze",
                totalTomes, new BigDecimal("6.99"), false, false, null));
    }

    private PurchaseAnalysis analyser(MangaEdition edition, String prix, BigDecimal port,
                                       BigDecimal protection, String url, String externalId, Set<Integer> tomes) {
        return service.analyze(new AnalyzeListingCommand(
                ListingPlatform.VINTED, url, "Lot " + edition.seriesTitle(), null, new BigDecimal(prix),
                port, port == null ? null : ShippingEstimateKind.FROM, protection, Condition.VERY_GOOD, false,
                List.of(new AnalyzeListingItemCommand(edition.seriesTitle(), edition.editionName(), tomes, null)),
                List.of(), externalId));
    }

    private static final Set<Integer> INTEGRALE =
            Set.of(1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14);

    // ================================================================== A

    @Test
    void une_premiere_annonce_analysee_devient_un_prix_releve_hors_frais() {
        MangaEdition edition = uneEdition(14);

        analyser(edition, "70", null, null, "https://www.vinted.fr/items/111-platinum-end", "111", INTEGRALE);

        List<MarketPriceObservation> releves = service.observationsOfEdition(edition.id());
        assertThat(releves).hasSize(1);
        MarketPriceObservation releve = releves.get(0);
        assertThat(releve.observedPrice()).isEqualByComparingTo("70");
        assertThat(releve.platform()).isEqualTo(ListingPlatform.VINTED);
        assertThat(releve.origin()).isEqualTo(MarketObservationOrigin.LISTING_ANALYSIS);
        assertThat(releve.volumeCount()).isEqualTo(14);
        assertThat(releve.listingIdentity()).isEqualTo("VINTED:111");
        assertThat(releve.sourceUrl()).isEqualTo("https://www.vinted.fr/items/111-platinum-end");
        assertThat(releve.observedAt()).isEqualTo(LocalDate.now());
    }

    // ================================================================== I

    @Test
    void le_prix_releve_est_celui_de_l_annonce_jamais_le_cout_d_acquisition() {
        MangaEdition edition = uneEdition(14);

        PurchaseAnalysis analyse = analyser(edition, "10", new BigDecimal("2.83"), new BigDecimal("1.20"),
                "https://www.vinted.fr/items/222", "222", INTEGRALE);

        // Le cout d'acquisition vaut bien 14,03 : c'est ce que l'acheteur paie.
        assertThat(analyse.totalRealCost()).isEqualByComparingTo("14.03");
        // Mais le marche, lui, ne connait que le prix affiche.
        MarketPriceObservation releve = service.observationsOfEdition(edition.id()).get(0);
        assertThat(releve.observedPrice()).isEqualByComparingTo("10");
        assertThat(releve.observedPrice()).isNotEqualByComparingTo("14.03");
    }

    // ================================================================== B, C

    @Test
    void reanalyser_la_meme_annonce_au_meme_prix_n_ajoute_aucun_releve() {
        MangaEdition edition = uneEdition(14);
        String url = "https://www.vinted.fr/items/333-platinum-end";

        analyser(edition, "70", null, null, url, "333", INTEGRALE);
        analyser(edition, "70", null, null, url, "333", INTEGRALE);
        analyser(edition, "70", null, null, url, "333", INTEGRALE);

        // Rien de neuf ne s'est produit sur le marche : une ligne suffit.
        assertThat(service.observationsOfEdition(edition.id())).hasSize(1);
    }

    @Test
    void reanalyser_la_meme_annonce_a_un_prix_different_conserve_l_historique() {
        MangaEdition edition = uneEdition(14);
        String url = "https://www.vinted.fr/items/444-platinum-end";

        analyser(edition, "70", null, null, url, "444", INTEGRALE);
        analyser(edition, "60", null, null, url, "444", INTEGRALE);

        List<MarketPriceObservation> releves = service.observationsOfEdition(edition.id());
        // Une baisse de prix dit quelque chose du marche : on la garde.
        assertThat(releves).hasSize(2);
        assertThat(releves).extracting(MarketPriceObservation::observedPrice)
                .usingElementComparator(BigDecimal::compareTo)
                .containsExactlyInAnyOrder(new BigDecimal("70"), new BigDecimal("60"));
        // Mais les deux portent la MEME identite : un seul vendeur.
        assertThat(releves).extracting(MarketPriceObservation::listingIdentity)
                .containsOnly("VINTED:444");
    }

    @Test
    void deux_liens_vers_la_meme_annonce_ne_font_qu_un_releve() {
        MangaEdition edition = uneEdition(14);

        analyser(edition, "70", null, null, "https://www.vinted.fr/items/555-avec-slug", "555", INTEGRALE);
        analyser(edition, "70", null, null, "https://vinted.fr/items/555?referrer=catalog", "555", INTEGRALE);

        assertThat(service.observationsOfEdition(edition.id())).hasSize(1);
    }

    // ================================================================== E

    @Test
    void une_annonce_reanalysee_ne_se_compare_pas_a_son_propre_prix_releve() {
        MangaEdition edition = uneEdition(14);
        String url = "https://www.vinted.fr/items/666-platinum-end";

        // Premiere analyse : le prix entre dans les releves.
        analyser(edition, "80", null, null, url, "666", INTEGRALE);
        assertThat(service.observationsOfEdition(edition.id())).hasSize(1);

        // Seconde analyse de la MEME annonce : son propre releve doit etre
        // ecarte, faute de quoi la reference vaudrait 80 et l'annonce se dirait
        // exactement "au prix du marche".
        PurchaseAnalysis seconde = analyser(edition, "80", null, null, url, "666", INTEGRALE);

        assertThat(seconde.assessment().referencePrice()).isNull();
        assertThat(seconde.assessment().referenceSampleSize()).isZero();
        assertThat(seconde.assessment().pricePosition().name()).isEqualTo("REFERENCE_UNAVAILABLE");
        assertThat(seconde.assessment().referenceGap())
                .isEqualTo(com.iozycore.manga.deals.ReferenceGap.ONLY_CURRENT_LISTING);
    }

    // ================================================================== H

    @Test
    void une_annonce_dont_l_edition_n_est_pas_identifiee_ne_produit_aucun_releve() {
        MangaEdition edition = uneEdition(14);
        long avant = service.observationsOfEdition(edition.id()).size();

        // "Lot manga divers" : aucune edition connue derriere.
        service.analyze(new AnalyzeListingCommand(ListingPlatform.VINTED,
                "https://www.vinted.fr/items/777", "Lot manga divers", null, new BigDecimal("40"),
                null, null, null, Condition.GOOD, false,
                List.of(new AnalyzeListingItemCommand("Serie totalement inconnue " + UUID.randomUUID(),
                        "Standard", Set.of(1, 2, 3), null)),
                List.of(), "777"));

        // Mieux vaut aucune reference qu'une reference mal rattachee.
        assertThat(service.observationsOfEdition(edition.id())).hasSize((int) avant);
    }

    @Test
    void un_lot_multi_series_ne_produit_aucun_releve() {
        MangaEdition premiere = uneEdition(14);
        MangaEdition seconde = uneEdition(14);

        service.analyze(new AnalyzeListingCommand(ListingPlatform.VINTED,
                "https://www.vinted.fr/items/888", "Deux series", null, new BigDecimal("120"),
                null, null, null, Condition.VERY_GOOD, false,
                List.of(new AnalyzeListingItemCommand(premiere.seriesTitle(), "Standard", INTEGRALE, null),
                        new AnalyzeListingItemCommand(seconde.seriesTitle(), "Standard", INTEGRALE, null)),
                List.of(), "888"));

        // Les 120 EUR couvrent l'ensemble. Les repartir au prorata fabriquerait
        // un prix que personne n'a jamais demande.
        assertThat(service.observationsOfEdition(premiere.id())).isEmpty();
        assertThat(service.observationsOfEdition(seconde.id())).isEmpty();
    }

    @Test
    void une_edition_sans_nombre_de_tomes_connu_produit_quand_meme_un_releve_de_lot_partiel() {
        // La composition du LOT est connue (3 tomes) meme si le total de
        // l'edition ne l'est pas : la forme reste determinable.
        MangaEdition edition = uneEdition(null);

        analyser(edition, "24", null, null, "https://www.vinted.fr/items/999", "999", Set.of(1, 2, 3));

        assertThat(service.observationsOfEdition(edition.id())).hasSize(1);
        assertThat(service.observationsOfEdition(edition.id()).get(0).volumeCount()).isEqualTo(3);
    }

    // ================================================================== F, G

    @Test
    void un_prix_estime_par_l_ia_ou_un_prix_neuf_catalogue_ne_deviennent_jamais_un_releve() {
        // L'edition porte un prix neuf catalogue (6,99 le tome) ; aucun provider
        // IA n'est configure en test, donc l'estimation est absente. Dans les
        // deux cas, seul le prix DEMANDE de l'annonce est releve - et une
        // analyse sans annonce exploitable n'en cree aucun.
        MangaEdition edition = uneEdition(14);
        assertThat(edition.retailPriceNewPerVolume()).isEqualByComparingTo("6.99");

        analyser(edition, "70", null, null, "https://www.vinted.fr/items/1010", "1010", INTEGRALE);

        List<MarketPriceObservation> releves = service.observationsOfEdition(edition.id());
        assertThat(releves).hasSize(1);
        // 14 x 6,99 = 97,86 : le prix catalogue n'a rien ecrit ici.
        assertThat(releves.get(0).observedPrice()).isEqualByComparingTo("70");
        assertThat(releves).allSatisfy(releve ->
                assertThat(releve.origin()).isEqualTo(MarketObservationOrigin.LISTING_ANALYSIS));
    }

    @Test
    void une_annonce_a_prix_nul_ne_produit_aucun_releve() {
        MangaEdition edition = uneEdition(14);

        analyser(edition, "0", null, null, "https://www.vinted.fr/items/1111", "1111", INTEGRALE);

        assertThat(service.observationsOfEdition(edition.id())).isEmpty();
    }

    @Test
    void une_annonce_saisie_a_la_main_ne_produit_aucun_releve_automatique() {
        MangaEdition edition = uneEdition(14);

        // Aucune URL, aucun identifiant externe : c'est le cas NORMAL, aucun
        // fournisseur public n'existant pour Vinted/Leboncoin/Rakuten.
        analyser(edition, "80", null, null, null, null, INTEGRALE);

        assertThat(service.observationsOfEdition(edition.id())).isEmpty();
    }

    @Test
    void une_annonce_sans_identite_analysee_deux_fois_ne_se_certifie_pas_son_propre_prix() {
        MangaEdition edition = uneEdition(14);

        // Le pendant de une_annonce_reanalysee_ne_se_compare_pas_a_son_propre_prix_releve,
        // sur le chemin qui n'a PAS d'identite. Sans le garde, la seconde analyse
        // rendait un sampleSize de 1 et une reference egale au prix demande - donc
        // une annonce declaree "au prix du marche" sur la foi d'elle-meme (constate
        // en direct le 2026-08-28 : sampleSize 2, reference 33 EUR, FAIR_PRICE).
        analyser(edition, "80", null, null, null, null, INTEGRALE);
        PurchaseAnalysis seconde = analyser(edition, "80", null, null, null, null, INTEGRALE);

        assertThat(service.observationsOfEdition(edition.id())).isEmpty();
        assertThat(seconde.assessment().referencePrice()).isNull();
        assertThat(seconde.assessment().referenceSampleSize()).isZero();
        assertThat(seconde.assessment().pricePosition().name()).isEqualTo("REFERENCE_UNAVAILABLE");
    }

    // ================================================================== J

    @Test
    void le_releve_manuel_continue_de_fonctionner_et_se_distingue() {
        MangaEdition edition = uneEdition(14);

        MarketPriceObservation manuel = service.recordMarketObservation(edition.id(), new VolumeRange(1, 14),
                new BigDecimal("65"), ListingPlatform.LEBONCOIN, Condition.GOOD, LocalDate.now(), "vu en boutique");
        analyser(edition, "70", null, null, "https://www.vinted.fr/items/1212", "1212", INTEGRALE);

        List<MarketPriceObservation> releves = service.observationsOfEdition(edition.id());
        assertThat(releves).hasSize(2);
        assertThat(releves).extracting(MarketPriceObservation::origin)
                .containsExactlyInAnyOrder(MarketObservationOrigin.MANUAL_ENTRY,
                        MarketObservationOrigin.LISTING_ANALYSIS);
        // Une saisie manuelle n'a pas d'annonce derriere elle, et ne se voit pas
        // imposer d'URL.
        MarketPriceObservation relu = releves.stream()
                .filter(o -> o.id().equals(manuel.id())).findFirst().orElseThrow();
        assertThat(relu.listingIdentity()).isNull();
        assertThat(relu.sourceUrl()).isNull();
        assertThat(relu.note()).isEqualTo("vu en boutique");
        assertThat(relu.volumeCount()).isEqualTo(14);
    }

    @Test
    void supprimer_une_analyse_ne_retire_pas_le_prix_qu_elle_a_releve() {
        MangaEdition edition = uneEdition(14);
        PurchaseAnalysis analyse = analyser(edition, "70", null, null,
                "https://www.vinted.fr/items/1313", "1313", INTEGRALE);
        assertThat(service.observationsOfEdition(edition.id())).hasSize(1);

        service.deleteAnalysis(analyse.id());

        // Un prix vu reste un prix vu : c'est une donnee de reference, pas un
        // sous-objet de l'analyse (meme regle que les editions).
        assertThat(service.observationsOfEdition(edition.id())).hasSize(1);
    }
}
