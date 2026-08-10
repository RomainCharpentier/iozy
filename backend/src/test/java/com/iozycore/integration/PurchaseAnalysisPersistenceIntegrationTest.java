package com.iozycore.integration;

import com.iozycore.purchaseanalysis.CollectorPreferences;
import com.iozycore.purchaseanalysis.CollectorPreferencesRepository;
import com.iozycore.purchaseanalysis.Condition;
import com.iozycore.purchaseanalysis.EditionTier;
import com.iozycore.purchaseanalysis.ListingPlatform;
import com.iozycore.purchaseanalysis.MangaEdition;
import com.iozycore.purchaseanalysis.MangaEditionRepository;
import com.iozycore.purchaseanalysis.MarketPriceObservation;
import com.iozycore.purchaseanalysis.MarketPriceObservationRepository;
import com.iozycore.purchaseanalysis.PurchaseAnalysisService;
import com.iozycore.purchaseanalysis.PurchaseAnalysisService.AnalyzeListingCommand;
import com.iozycore.purchaseanalysis.PurchaseAnalysisService.AnalyzeListingItemCommand;
import com.iozycore.purchaseanalysis.PurchaseAnalysis;
import com.iozycore.purchaseanalysis.VolumeRange;
import jakarta.persistence.EntityManager;
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
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Validates the Purchase Analysis persistence module (Flyway V4 + JPA)
 * against a real PostgreSQL - mirrors EntityPersistenceIntegrationTest.
 */
@Testcontainers
@SpringBootTest
@Transactional
class PurchaseAnalysisPersistenceIntegrationTest {

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
    private MangaEditionRepository mangaEditionRepository;

    @Autowired
    private MarketPriceObservationRepository marketPriceObservationRepository;

    @Autowired
    private CollectorPreferencesRepository collectorPreferencesRepository;

    @Autowired
    private PurchaseAnalysisService purchaseAnalysisService;

    @Autowired
    private EntityManager entityManager;

    @Test
    void a_manga_edition_can_be_saved_reloaded_and_looked_up_case_insensitively() {
        MangaEdition edition = MangaEdition.create("Death Note " + UUID.randomUUID(), "Black Edition",
                EditionTier.DELUXE, "Kana", 6, new BigDecimal("14.90"), false, false, null);
        mangaEditionRepository.save(edition);

        MangaEdition reloaded = mangaEditionRepository.findBySeriesAndEdition(
                edition.seriesTitle().toUpperCase(), edition.editionName().toUpperCase()).orElseThrow();

        assertThat(reloaded.id()).isEqualTo(edition.id());
        assertThat(reloaded.totalVolumes()).isEqualTo(6);
        assertThat(reloaded.retailPriceNewPerVolume()).isEqualByComparingTo(new BigDecimal("14.90"));
    }

    @Test
    void duplicate_series_and_edition_name_are_rejected_by_the_unique_constraint() {
        String seriesTitle = "Parasyte " + UUID.randomUUID();
        mangaEditionRepository.save(MangaEdition.create(seriesTitle, "Standard", EditionTier.STANDARD, "Tonkam",
                10, new BigDecimal("7.50"), false, false, null));

        // save() alone only queues the INSERT in the persistence context - the unique
        // constraint is only actually checked by Postgres once the write is flushed. A
        // raw EntityManager.flush() (unlike a Spring Data repository call) is not wrapped
        // by Spring's exception translation, hence the JPA-level exception type here.
        assertThatThrownBy(() -> {
            mangaEditionRepository.save(MangaEdition.create(seriesTitle, "Standard", EditionTier.STANDARD, "Tonkam",
                    10, new BigDecimal("7.50"), false, false, null));
            entityManager.flush();
        }).isInstanceOf(jakarta.persistence.PersistenceException.class);
    }

    @Test
    void an_edition_can_be_progressively_enriched_via_partial_updates() {
        MangaEdition edition = mangaEditionRepository.save(MangaEdition.create("My Home Hero " + UUID.randomUUID(),
                "Standard", EditionTier.STANDARD, null, null, null, false, false, null));

        MangaEdition enriched = edition.withUpdatedReferenceData(null, "Kodansha", 26, new BigDecimal("6.90"),
                null, null, null);
        mangaEditionRepository.save(enriched);

        MangaEdition reloaded = mangaEditionRepository.findById(edition.id()).orElseThrow();
        assertThat(reloaded.publisher()).isEqualTo("Kodansha");
        assertThat(reloaded.totalVolumes()).isEqualTo(26);
        assertThat(reloaded.retailPriceNewPerVolume()).isEqualByComparingTo(new BigDecimal("6.90"));
    }

    @Test
    void market_price_observations_are_appended_and_retrievable_by_edition() {
        MangaEdition edition = mangaEditionRepository.save(MangaEdition.create("Sanctuary " + UUID.randomUUID(),
                "Perfect Edition", EditionTier.PERFECT, "Glénat", 6, new BigDecimal("24.90"), false, false, null));

        marketPriceObservationRepository.save(MarketPriceObservation.record_(edition.id(), new VolumeRange(1, 6),
                new BigDecimal("140"), ListingPlatform.VINTED, Condition.VERY_GOOD, LocalDate.now(), "Vinted lot"));
        marketPriceObservationRepository.save(MarketPriceObservation.record_(edition.id(), null,
                new BigDecimal("150"), ListingPlatform.LEBONCOIN, null, LocalDate.now(), null));

        List<MarketPriceObservation> observations = marketPriceObservationRepository.findByEditionId(edition.id());
        assertThat(observations).hasSize(2);
        assertThat(observations).extracting(MarketPriceObservation::platform)
                .containsExactlyInAnyOrder(ListingPlatform.VINTED, ListingPlatform.LEBONCOIN);
    }

    @Test
    void collector_preferences_fall_back_to_defaults_before_any_save_then_persist_once_updated() {
        CollectorPreferences beforeAnySave = collectorPreferencesRepository.find();
        assertThat(beforeAnySave).isEqualTo(CollectorPreferences.defaults());

        CollectorPreferences updated = new CollectorPreferences(false, false, true,
                beforeAnySave.editionTierRanking(), true, true, true,
                com.iozycore.purchaseanalysis.WeightLevel.MEDIUM, 15, beforeAnySave.factorWeights());
        collectorPreferencesRepository.save(updated);

        CollectorPreferences reloaded = collectorPreferencesRepository.find();
        assertThat(reloaded.preferCompletedSeries()).isFalse();
        assertThat(reloaded.minimumDiscountVsRetailPercent()).isEqualTo(15);
    }

    @Test
    void analyzing_a_listing_persists_a_full_history_entry_reloadable_by_id() {
        MangaEdition edition = mangaEditionRepository.save(MangaEdition.create("Vagabond " + UUID.randomUUID(),
                "VIZBIG Edition", EditionTier.INTEGRAL, "Kodansha", 3, new BigDecimal("25"), false, false, null));

        AnalyzeListingCommand command = new AnalyzeListingCommand(ListingPlatform.VINTED, null, "Vagabond lot",
                new BigDecimal("50"), BigDecimal.ZERO, BigDecimal.ZERO, Condition.VERY_GOOD, false,
                List.of(new AnalyzeListingItemCommand(edition.seriesTitle(), edition.editionName(),
                        Set.of(1, 2, 3), null)),
                List.of());

        PurchaseAnalysis analysis = purchaseAnalysisService.analyze(command);

        // Force an actual round-trip through the JSONB column - without this,
        // findAnalysisById below could be served straight from the Hibernate
        // L1 session cache (same persistence context as the save above),
        // silently skipping real (de)serialization of result_payload.
        entityManager.flush();
        entityManager.clear();

        PurchaseAnalysis reloaded = purchaseAnalysisService.findAnalysisById(analysis.id()).orElseThrow();
        assertThat(reloaded.listing().rawTitle()).isEqualTo("Vagabond lot");
        assertThat(reloaded.itemBreakdown()).hasSize(1);
        assertThat(reloaded.itemBreakdown().get(0).matchedEdition().id()).isEqualTo(edition.id());
        assertThat(purchaseAnalysisService.history()).extracting(PurchaseAnalysis::id).contains(analysis.id());
    }
}
