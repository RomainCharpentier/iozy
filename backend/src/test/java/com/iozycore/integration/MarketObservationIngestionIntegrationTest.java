package com.iozycore.integration;

import com.iozycore.manga.domain.EditionTier;
import com.iozycore.manga.domain.MangaEdition;
import com.iozycore.manga.domain.MangaEditionRepository;
import com.iozycore.core.listing.ShippingEstimateKind;
import com.iozycore.manga.domain.deals.Condition;
import com.iozycore.core.listing.ListingPlatform;
import com.iozycore.manga.domain.deals.MarketObservationOrigin;
import com.iozycore.manga.domain.deals.MarketPriceObservation;
import com.iozycore.manga.domain.deals.PurchaseAnalysis;
import com.iozycore.manga.application.deals.PurchaseAnalysisService;
import com.iozycore.manga.application.deals.PurchaseAnalysisService.AnalyzeListingCommand;
import com.iozycore.manga.application.deals.PurchaseAnalysisService.AnalyzeListingItemCommand;
import com.iozycore.manga.domain.deals.VolumeRange;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * <b>The normal use of IozyCore must feed the observed prices - without ever
 * making up a sample.</b>
 *
 * <h2>What is checked here, and not elsewhere</h2>
 * The independence rules are tested in the pure domain. What needs a real
 * database is the <b>trigger</b>: which analysis creates an observation, which one
 * does not, and what the row really contains once read again from
 * PostgreSQL - in particular that the recorded price is the listing price and not
 * the acquisition cost.
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

        // The acquisition cost is indeed 14.03: this is what the buyer pays.
        assertThat(analyse.totalRealCost()).isEqualByComparingTo("14.03");
        // But the market only knows the displayed price.
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

        // Nothing new happened on the market: one row is enough.
        assertThat(service.observationsOfEdition(edition.id())).hasSize(1);
    }

    @Test
    void reanalyser_la_meme_annonce_a_un_prix_different_conserve_l_historique() {
        MangaEdition edition = uneEdition(14);
        String url = "https://www.vinted.fr/items/444-platinum-end";

        analyser(edition, "70", null, null, url, "444", INTEGRALE);
        analyser(edition, "60", null, null, url, "444", INTEGRALE);

        List<MarketPriceObservation> releves = service.observationsOfEdition(edition.id());
        // A price drop says something about the market: we keep it.
        assertThat(releves).hasSize(2);
        assertThat(releves).extracting(MarketPriceObservation::observedPrice)
                .usingElementComparator(BigDecimal::compareTo)
                .containsExactlyInAnyOrder(new BigDecimal("70"), new BigDecimal("60"));
        // But both carry the SAME identity: one single seller.
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

        // First analysis: the price enters the observations.
        analyser(edition, "80", null, null, url, "666", INTEGRALE);
        assertThat(service.observationsOfEdition(edition.id())).hasSize(1);

        // Second analysis of the SAME listing: its own observation must be
        // discarded, otherwise the reference would be 80 and the listing would say it is
        // exactly "at market price".
        PurchaseAnalysis seconde = analyser(edition, "80", null, null, url, "666", INTEGRALE);

        assertThat(seconde.assessment().referencePrice()).isNull();
        assertThat(seconde.assessment().referenceSampleSize()).isZero();
        assertThat(seconde.assessment().pricePosition().name()).isEqualTo("REFERENCE_UNAVAILABLE");
        assertThat(seconde.assessment().referenceGap())
                .isEqualTo(com.iozycore.manga.domain.deals.ReferenceGap.ONLY_CURRENT_LISTING);
    }

    // ================================================================== H

    @Test
    void une_annonce_dont_l_edition_n_est_pas_identifiee_ne_produit_aucun_releve() {
        MangaEdition edition = uneEdition(14);
        long avant = service.observationsOfEdition(edition.id()).size();

        // "Lot manga divers": no known edition behind it.
        service.analyze(new AnalyzeListingCommand(ListingPlatform.VINTED,
                "https://www.vinted.fr/items/777", "Lot manga divers", null, new BigDecimal("40"),
                null, null, null, Condition.GOOD, false,
                List.of(new AnalyzeListingItemCommand("Serie totalement inconnue " + UUID.randomUUID(),
                        "Standard", Set.of(1, 2, 3), null)),
                List.of(), "777"));

        // Better no reference than a badly attached reference.
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

        // The 120 EUR cover the whole set. Splitting them pro rata would make up
        // a price that nobody ever asked for.
        assertThat(service.observationsOfEdition(premiere.id())).isEmpty();
        assertThat(service.observationsOfEdition(seconde.id())).isEmpty();
    }

    @Test
    void une_edition_sans_nombre_de_tomes_connu_produit_quand_meme_un_releve_de_lot_partiel() {
        // The composition of the LOT is known (3 volumes) even if the total of
        // the edition is not: the shape can still be determined.
        MangaEdition edition = uneEdition(null);

        analyser(edition, "24", null, null, "https://www.vinted.fr/items/999", "999", Set.of(1, 2, 3));

        assertThat(service.observationsOfEdition(edition.id())).hasSize(1);
        assertThat(service.observationsOfEdition(edition.id()).get(0).volumeCount()).isEqualTo(3);
    }

    // ================================================================== F, G

    @Test
    void un_prix_estime_par_l_ia_ou_un_prix_neuf_catalogue_ne_deviennent_jamais_un_releve() {
        // The edition has a new catalogue price (6.99 per volume); no AI provider
        // is configured in the test, so the estimate is absent. In both
        // cases, only the ASKED price of the listing is observed - and an
        // analysis without a usable listing creates none.
        MangaEdition edition = uneEdition(14);
        assertThat(edition.retailPriceNewPerVolume()).isEqualByComparingTo("6.99");

        analyser(edition, "70", null, null, "https://www.vinted.fr/items/1010", "1010", INTEGRALE);

        List<MarketPriceObservation> releves = service.observationsOfEdition(edition.id());
        assertThat(releves).hasSize(1);
        // 14 x 6.99 = 97.86: the catalogue price wrote nothing here.
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

        // No URL, no external identifier: this is the NORMAL case, since no
        // public provider exists for Vinted/Leboncoin/Rakuten.
        analyser(edition, "80", null, null, null, null, INTEGRALE);

        assertThat(service.observationsOfEdition(edition.id())).isEmpty();
    }

    @Test
    void une_annonce_sans_identite_analysee_deux_fois_ne_se_certifie_pas_son_propre_prix() {
        MangaEdition edition = uneEdition(14);

        // The counterpart of une_annonce_reanalysee_ne_se_compare_pas_a_son_propre_prix_releve,
        // on the path that does NOT have an identity. Without the guard, the second analysis
        // returned a sampleSize of 1 and a reference equal to the asked price - so
        // a listing declared "at market price" on the word of itself (seen
        // live on 2026-08-28: sampleSize 2, reference 33 EUR, FAIR_PRICE).
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
        // A manual entry has no listing behind it, and is not
        // forced to give a URL.
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

        // A price seen stays a price seen: it is reference data, not a
        // sub-object of the analysis (same rule as the editions).
        assertThat(service.observationsOfEdition(edition.id())).hasSize(1);
    }
}
