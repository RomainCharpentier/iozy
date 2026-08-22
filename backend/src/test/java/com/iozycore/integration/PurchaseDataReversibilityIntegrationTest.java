package com.iozycore.integration;

import com.iozycore.domain.catalog.EditionTier;
import com.iozycore.domain.catalog.MangaEdition;
import com.iozycore.domain.catalog.MangaEditionRepository;
import com.iozycore.listing.ShippingEstimateKind;
import com.iozycore.purchaseanalysis.Condition;
import com.iozycore.purchaseanalysis.ListingPlatform;
import com.iozycore.purchaseanalysis.MarketPriceObservation;
import com.iozycore.purchaseanalysis.PurchaseAnalysis;
import com.iozycore.purchaseanalysis.PurchaseAnalysisService;
import com.iozycore.purchaseanalysis.PurchaseAnalysisService.AnalyzeListingCommand;
import com.iozycore.purchaseanalysis.PurchaseAnalysisService.AnalyzeListingItemCommand;
import com.iozycore.purchaseanalysis.VolumeRange;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.transaction.annotation.Transactional;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;

/**
 * Les deux données de l'Analyse d'achat que l'utilisateur crée explicitement -
 * une analyse enregistrée, un prix relevé - doivent pouvoir être retirées.
 * <p>
 * Ni l'une ni l'autre n'est modifiable, et c'est délibéré : une analyse est le
 * résultat figé d'un calcul (en corriger un chiffre produirait un verdict qui
 * n'a jamais été calculé) et un relevé est un fait constaté à une date (le
 * réécrire après coup réécrirait le passé sur lequel s'appuient les analyses).
 * On supprime, et on recommence.
 * <p>
 * Le point le plus important est vérifié ici : supprimer une analyse ne touche
 * PAS aux prix relevés ni aux éditions renseignés au fil de cette analyse - ce
 * sont des données de référence, qui servent toutes les analyses suivantes.
 */
@Testcontainers
@SpringBootTest
@Transactional
class PurchaseDataReversibilityIntegrationTest {

    @Container
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine")
            .withDatabaseName("iozycore_test")
            .withUsername("iozycore")
            .withPassword("iozycore");

    @DynamicPropertySource
    static void configureDatasource(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
        registry.add("spring.datasource.username", POSTGRES::getUsername);
        registry.add("spring.datasource.password", POSTGRES::getPassword);
    }

    @Autowired
    private PurchaseAnalysisService service;

    @Autowired
    private MangaEditionRepository mangaEditionRepository;

    private MangaEdition uneEdition() {
        return mangaEditionRepository.save(MangaEdition.create(
                "Vinland Saga " + UUID.randomUUID(), "Standard", EditionTier.STANDARD, "Kurokawa",
                27, new BigDecimal("7.65"), false, false, null));
    }

    private PurchaseAnalysis uneAnalyse(MangaEdition edition) {
        return service.analyze(new AnalyzeListingCommand(
                ListingPlatform.VINTED, null, "Lot " + edition.seriesTitle(),
                null, new BigDecimal("60"), BigDecimal.ZERO, ShippingEstimateKind.UNKNOWN, BigDecimal.ZERO, Condition.VERY_GOOD, false,
                List.of(new AnalyzeListingItemCommand(edition.seriesTitle(), edition.editionName(), Set.of(1, 2, 3), null)),
                List.of()));
    }

    @Test
    void une_analyse_enregistree_peut_etre_supprimee_de_l_historique() {
        MangaEdition edition = uneEdition();
        PurchaseAnalysis analyse = uneAnalyse(edition);
        assertThat(service.history()).extracting(PurchaseAnalysis::id).contains(analyse.id());

        service.deleteAnalysis(analyse.id());

        assertThat(service.findAnalysisById(analyse.id())).isEmpty();
        assertThat(service.history()).extracting(PurchaseAnalysis::id).doesNotContain(analyse.id());
    }

    @Test
    void supprimer_une_analyse_conserve_les_prix_releves_et_l_edition() {
        MangaEdition edition = uneEdition();
        MarketPriceObservation releve = service.recordMarketObservation(
                edition.id(), new VolumeRange(1, 3), new BigDecimal("18"), ListingPlatform.VINTED,
                Condition.VERY_GOOD, LocalDate.now(), null);
        PurchaseAnalysis analyse = uneAnalyse(edition);

        service.deleteAnalysis(analyse.id());

        // Ce sont des données de référence, pas des sous-objets de l'analyse :
        // les emporter appauvrirait toutes les analyses suivantes.
        assertThat(service.observationsOfEdition(edition.id())).extracting(MarketPriceObservation::id)
                .contains(releve.id());
        assertThat(mangaEditionRepository.findById(edition.id())).isPresent();
    }

    @Test
    void supprimer_une_analyse_ne_touche_pas_aux_autres_analyses() {
        MangaEdition edition = uneEdition();
        PurchaseAnalysis premiere = uneAnalyse(edition);
        PurchaseAnalysis seconde = uneAnalyse(edition);

        service.deleteAnalysis(premiere.id());

        assertThat(service.findAnalysisById(seconde.id())).isPresent();
    }

    @Test
    void un_prix_releve_peut_etre_relu_puis_supprime() {
        MangaEdition edition = uneEdition();
        MarketPriceObservation releve = service.recordMarketObservation(
                edition.id(), null, new BigDecimal("450"), ListingPlatform.LEBONCOIN,
                Condition.GOOD, LocalDate.now(), "Virgule oubliée");

        assertThat(service.observationsOfEdition(edition.id())).extracting(MarketPriceObservation::id)
                .contains(releve.id());

        service.deleteMarketObservation(releve.id());

        assertThat(service.observationsOfEdition(edition.id())).extracting(MarketPriceObservation::id)
                .doesNotContain(releve.id());
        // Retirer un relevé ne touche pas à l'édition qu'il documentait.
        assertThat(mangaEditionRepository.findById(edition.id())).isPresent();
    }

    @Test
    void supprimer_un_releve_ne_touche_pas_aux_autres_releves_de_l_edition() {
        MangaEdition edition = uneEdition();
        MarketPriceObservation faux = service.recordMarketObservation(
                edition.id(), null, new BigDecimal("450"), ListingPlatform.VINTED, null, LocalDate.now(), null);
        MarketPriceObservation juste = service.recordMarketObservation(
                edition.id(), null, new BigDecimal("45"), ListingPlatform.VINTED, null, LocalDate.now(), null);

        service.deleteMarketObservation(faux.id());

        assertThat(service.observationsOfEdition(edition.id())).extracting(MarketPriceObservation::id)
                .containsExactly(juste.id());
    }

    @Test
    void les_deux_suppressions_sont_idempotentes() {
        assertThatCode(() -> service.deleteAnalysis(UUID.randomUUID())).doesNotThrowAnyException();
        assertThatCode(() -> service.deleteMarketObservation(UUID.randomUUID())).doesNotThrowAnyException();
    }
}
