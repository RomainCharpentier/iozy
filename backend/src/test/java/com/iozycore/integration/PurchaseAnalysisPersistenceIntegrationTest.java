package com.iozycore.integration;

import com.iozycore.domain.catalog.Entity;
import com.iozycore.domain.catalog.EntityRepository;
import com.iozycore.domain.catalog.EntityTypeFixtures;
import com.iozycore.domain.catalog.Variant;
import com.iozycore.domain.ownership.Ownership;
import com.iozycore.domain.ownership.OwnershipCondition;
import com.iozycore.purchaseanalysis.CollectionStatus;
import com.iozycore.purchaseanalysis.CollectorPreferences;
import com.iozycore.purchaseanalysis.CollectorPreferencesRepository;
import com.iozycore.purchaseanalysis.Condition;
import com.iozycore.purchaseanalysis.EditionSuggestion;
import com.iozycore.domain.catalog.EditionTier;
import com.iozycore.purchaseanalysis.ListingPlatform;
import com.iozycore.domain.catalog.MangaEdition;
import com.iozycore.domain.catalog.MangaEditionRepository;
import com.iozycore.purchaseanalysis.MarketPriceObservation;
import com.iozycore.purchaseanalysis.MarketPriceObservationRepository;
import com.iozycore.purchaseanalysis.PurchaseAnalysisService;
import com.iozycore.purchaseanalysis.PurchaseAnalysisService.AnalyzeListingCommand;
import com.iozycore.purchaseanalysis.PurchaseAnalysisService.AnalyzeListingItemCommand;
import com.iozycore.purchaseanalysis.PurchaseAnalysisService.NearCompleteSuggestion;
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
import java.util.Map;
import java.util.Optional;
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

    @Autowired
    private EntityRepository entityRepository;

    @Autowired
    private com.iozycore.domain.ownership.OwnershipRepository ownershipRepository;

    @Autowired
    private com.iozycore.application.QuickAddService quickAddService;

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
    }

    @Test
    void an_edition_created_through_the_add_flow_is_fully_enrichable_through_the_same_purchase_analysis_pipeline() {
        // Étape 7 (réutiliser le pipeline d'enrichissement existant) : une Édition créée
        // via l'ajout rapide (QuickAddService, étape 3) est un MangaEdition comme un
        // autre - le même PATCH /editions/{id} déjà utilisé par l'Analyse d'achat
        // fonctionne dessus sans distinction, aucune donnée dupliquée ni pipeline séparé.
        String seriesTitle = "Vinland Saga " + UUID.randomUUID();
        com.iozycore.application.QuickAddService.QuickAddResult result = quickAddService.addNewEntityWithOwnership(
                EntityTypeFixtures.MANGA.id(), seriesTitle, com.iozycore.domain.ownership.OwnershipCondition.NEW,
                Map.of(), 1, "Deluxe");

        MangaEdition created = mangaEditionRepository.findBySeriesAndEdition(seriesTitle, "Deluxe").orElseThrow();
        assertThat(created.entityId()).isEqualTo(result.entityId()); // lié dès la création (étape 3)
        assertThat(created.tier()).isEqualTo(EditionTier.OTHER); // strict minimum, rien deviné à la création
        assertThat(created.totalVolumes()).isNull();
        assertThat(created.publisher()).isNull();

        MangaEdition enriched = purchaseAnalysisService.updateEdition(created.id(), EditionTier.DELUXE,
                "Kurokawa", 10, new BigDecimal("19.90"), false, false, null);

        assertThat(enriched.entityId()).isEqualTo(result.entityId()); // le lien à la Série survit à l'enrichissement
        assertThat(enriched.publisher()).isEqualTo("Kurokawa");
        MangaEdition reloaded = mangaEditionRepository.findById(created.id()).orElseThrow();
        assertThat(reloaded.totalVolumes()).isEqualTo(10); // persisté
        assertThat(reloaded.retailPriceNewPerVolume()).isEqualByComparingTo(new BigDecimal("19.90"));
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
    void deleting_an_edition_is_refused_while_a_price_observation_still_refers_to_it() {
        // Avant ce garde-fou, seule la contrainte de clé étrangère de Postgres
        // protégeait la table : la suppression remontait une erreur SQL brute
        // (500) au lieu du refus explicite déjà prévu pour les tomes.
        MangaEdition edition = mangaEditionRepository.save(MangaEdition.create("Pluto " + UUID.randomUUID(),
                "Deluxe", EditionTier.DELUXE, "Delcourt", 8, new BigDecimal("15.50"), false, false, null));
        marketPriceObservationRepository.save(MarketPriceObservation.record_(edition.id(), new VolumeRange(1, 8),
                new BigDecimal("90"), ListingPlatform.VINTED, Condition.GOOD, LocalDate.now(), null));

        var blocages = purchaseAnalysisService.deleteEdition(edition.id());

        assertThat(blocages.none()).isFalse();
        assertThat(blocages.linkedObservations()).isEqualTo(1);
        assertThat(blocages.linkedVolumes()).isZero();
        assertThat(mangaEditionRepository.findById(edition.id())).isPresent();
    }

    @Test
    void an_edition_that_nothing_refers_to_is_deleted() {
        MangaEdition edition = mangaEditionRepository.save(MangaEdition.create("Vinland Saga " + UUID.randomUUID(),
                "Standard", EditionTier.STANDARD, "Kurokawa", 27, new BigDecimal("7.65"), false, false, null));

        var blocages = purchaseAnalysisService.deleteEdition(edition.id());

        assertThat(blocages.none()).isTrue();
        assertThat(mangaEditionRepository.findById(edition.id())).isEmpty();
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
                null, new BigDecimal("50"), BigDecimal.ZERO, BigDecimal.ZERO, Condition.VERY_GOOD, false,
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

    @Test
    void computes_completeness_for_a_series_already_in_the_collection() {
        MangaEdition edition = mangaEditionRepository.save(MangaEdition.create("My Home Hero " + UUID.randomUUID(),
                "Standard", EditionTier.STANDARD, "Kodansha", 26, new BigDecimal("6.90"), false, false, null));

        CollectionStatus status = purchaseAnalysisService.computeCompleteness(
                null, edition.seriesTitle(), edition.editionName(), Set.of(1, 2, 3, 4, 5));

        assertThat(status.isKnown()).isTrue();
        assertThat(status.missingCount()).isEqualTo(21);
        assertThat(status.estimatedCostToComplete()).isEqualByComparingTo(new BigDecimal("144.90")); // 21 * 6.90
        assertThat(status.costToCompleteBasis().name()).isEqualTo("THEORETICAL_ONLY");
    }

    @Test
    void completeness_is_unknown_rather_than_guessed_for_an_edition_never_entered() {
        CollectionStatus status = purchaseAnalysisService.computeCompleteness(
                null, "Some Series Never Analyzed " + UUID.randomUUID(), "Standard", Set.of(1, 2));

        assertThat(status.isKnown()).isFalse();
        assertThat(status.estimatedCostToComplete()).isNull();
    }

    @Test
    void edition_ai_suggestion_is_safely_absent_when_no_provider_key_is_configured() {
        // Aucune clé gemini.api-key dans ce contexte de test (voir application.yml) - vérifie que le
        // câblage Spring bout-en-bout (Service -> AiEditionAdvisor -> GeminiEditionAdvisor) reste
        // silencieux plutôt que d'échouer, même règle que BGG/IGDB sans identifiants.
        Optional<EditionSuggestion> suggestion =
                purchaseAnalysisService.suggestEditionReferenceData("Death Note", "Black Édition");

        assertThat(suggestion).isEmpty();
    }

    @Test
    void near_complete_suggestions_only_lists_owned_series_with_a_known_incomplete_named_edition() {
        String seriesTitle = "My Home Hero " + UUID.randomUUID();
        mangaEditionRepository.save(MangaEdition.create(seriesTitle, "Standard", EditionTier.STANDARD, "Kodansha",
                26, new BigDecimal("6.90"), false, false, null));

        Entity entity = Entity.create(EntityTypeFixtures.MANGA.id(), seriesTitle);
        for (int volume = 1; volume <= 24; volume++) {
            entity.addVariant("Tome " + volume, Map.of("volumeNumber", volume, "edition", "Standard"));
        }
        entityRepository.save(entity); // la Série (et ses Variant) doivent exister avant qu'une Ownership les référence (FK)
        for (Variant variant : entity.variants()) {
            ownershipRepository.save(Ownership.acquire(entity.id(), variant.id(), OwnershipCondition.NEW, LocalDate.now(), null));
        }

        List<NearCompleteSuggestion> suggestions = purchaseAnalysisService.findNearCompleteSuggestions();

        NearCompleteSuggestion suggestion = suggestions.stream()
                .filter(s -> s.entityId().equals(entity.id())).findFirst().orElseThrow();
        assertThat(suggestion.editionName()).isEqualTo("Standard");
        assertThat(suggestion.ownedCount()).isEqualTo(24);
        assertThat(suggestion.totalVolumes()).isEqualTo(26);
        assertThat(suggestion.missingCount()).isEqualTo(2);
    }

    @Test
    void near_complete_suggestions_ignores_variants_without_a_named_edition() {
        String seriesTitle = "Vagabond " + UUID.randomUUID();
        Entity entity = Entity.create(EntityTypeFixtures.MANGA.id(), seriesTitle);
        entity.addVariant("Tome 1", Map.of("volumeNumber", 1)); // no "edition" attribute
        entityRepository.save(entity);

        List<NearCompleteSuggestion> suggestions = purchaseAnalysisService.findNearCompleteSuggestions();

        assertThat(suggestions).noneMatch(s -> s.entityId().equals(entity.id()));
    }

    @Test
    void near_complete_suggestions_never_counts_a_catalogued_but_unowned_tome_as_owned() {
        // Étape 6 (modèle Tome != Ownership) : un Variant catalogué sans Ownership active
        // (ex: exemplaire revendu puis son Ownership supprimée, voir OwnershipDeletionService)
        // ne doit jamais gonfler ownedCount ni disparaître silencieusement de missingVolumeNumbers -
        // et doit être reconnaissable comme "déjà catalogué" plutôt que purement virtuel.
        String seriesTitle = "Parasyte " + UUID.randomUUID();
        mangaEditionRepository.save(MangaEdition.create(seriesTitle, "Standard", EditionTier.STANDARD, "Tonkam",
                10, new BigDecimal("7.50"), false, false, null));

        Entity entity = Entity.create(EntityTypeFixtures.MANGA.id(), seriesTitle);
        Variant owned1 = entity.addVariant("Tome 1", Map.of("volumeNumber", 1, "edition", "Standard"));
        Variant owned2 = entity.addVariant("Tome 2", Map.of("volumeNumber", 2, "edition", "Standard"));
        entity.addVariant("Tome 3", Map.of("volumeNumber", 3, "edition", "Standard")); // catalogué, jamais possédé
        entityRepository.save(entity);
        ownershipRepository.save(Ownership.acquire(entity.id(), owned1.id(), OwnershipCondition.NEW, LocalDate.now(), null));
        ownershipRepository.save(Ownership.acquire(entity.id(), owned2.id(), OwnershipCondition.NEW, LocalDate.now(), null));
        // Tomes 4-10 : purement virtuels, aucun Variant catalogué du tout.

        NearCompleteSuggestion suggestion = purchaseAnalysisService.findNearCompleteSuggestions().stream()
                .filter(s -> s.entityId().equals(entity.id())).findFirst().orElseThrow();

        assertThat(suggestion.ownedCount()).isEqualTo(2); // pas 3
        assertThat(suggestion.missingCount()).isEqualTo(8); // tomes 3 à 10
        assertThat(suggestion.cataloguedMissingVolumeNumbers()).containsExactly(3); // catalogué, juste pas possédé
        assertThat(suggestion.missingVolumeNumbers()).contains(3, 4, 10); // virtuels ET catalogué, tous "manquants"
    }

    @Test
    void analyzing_a_listing_flags_volumes_already_owned_in_the_real_collection_as_duplicates() {
        String seriesTitle = "My Home Hero " + UUID.randomUUID();
        Entity entity = Entity.create(EntityTypeFixtures.MANGA.id(), seriesTitle);
        entity.addVariant("Tome 1", Map.of("volumeNumber", 1, "edition", "Standard"));
        entity.addVariant("Tome 2", Map.of("volumeNumber", 2, "edition", "Standard"));
        entityRepository.save(entity);

        ownershipRepository.save(com.iozycore.domain.ownership.Ownership.acquire(entity.id(),
                entity.findVariantByLabel("Tome 1").orElseThrow().id(),
                com.iozycore.domain.ownership.OwnershipCondition.NEW, LocalDate.now(), null));
        ownershipRepository.save(com.iozycore.domain.ownership.Ownership.acquire(entity.id(),
                entity.findVariantByLabel("Tome 2").orElseThrow().id(),
                com.iozycore.domain.ownership.OwnershipCondition.NEW, LocalDate.now(), null));

        AnalyzeListingCommand command = new AnalyzeListingCommand(ListingPlatform.VINTED, null, "Lot avec doublons",
                null, new BigDecimal("15"), BigDecimal.ZERO, BigDecimal.ZERO, Condition.GOOD, false,
                List.of(new AnalyzeListingItemCommand(seriesTitle, "Standard", Set.of(1, 2, 3), null)),
                List.of());

        PurchaseAnalysis analysis = purchaseAnalysisService.analyze(command);

        com.iozycore.purchaseanalysis.DuplicateAnalysis duplicates = analysis.itemBreakdown().get(0).duplicates();
        assertThat(duplicates.duplicateVolumeNumbers()).containsExactlyInAnyOrder(1, 2);
        assertThat(duplicates.usefulVolumeCount()).isEqualTo(1);
    }

    // --- Migration "Série -> Édition par ID" (historique de la conversation) ---
    // Le titre ne doit plus jamais être la relation persistante entre une Série et
    // ses Éditions : un renommage doit pouvoir modifier UNIQUEMENT Entity.title
    // sans casser ni dupliquer quoi que ce soit côté MangaEdition/Variant.

    @Test
    void renaming_a_series_does_not_orphan_or_duplicate_its_editions_or_tomes() {
        UUID mangaTypeId = EntityTypeFixtures.MANGA.id();
        String originalTitle = "Naruto " + UUID.randomUUID();

        // Série avec PLUSIEURS Éditions (scénario 1) : tome 1 de "Kana", tome 1 de
        // "Perfect Edition" - deux MangaEdition distinctes, toutes deux reliées par
        // entityId (voir resolveOrCreateMangaEdition, jamais un doublon).
        var kanaTome1 = quickAddService.addNewEntityWithOwnership(mangaTypeId, originalTitle,
                OwnershipCondition.NEW, Map.of(), 1, "Kana");
        quickAddService.addNewEntityWithOwnership(mangaTypeId, originalTitle,
                OwnershipCondition.NEW, Map.of(), 1, "Perfect Edition");
        UUID entityId = kanaTome1.entityId();

        List<MangaEdition> editionsBeforeRename = mangaEditionRepository.findByEntityId(entityId);
        assertThat(editionsBeforeRename).hasSize(2);
        UUID kanaEditionId = editionsBeforeRename.stream()
                .filter(e -> e.editionName().equalsIgnoreCase("Kana")).findFirst().orElseThrow().id();

        // Renommage (scénario 2) : UNIQUEMENT Entity.title, rien côté MangaEdition.
        String newTitle = "L'Histoire de Naruto " + UUID.randomUUID();
        Entity entity = entityRepository.findById(entityId).orElseThrow();
        entity.rename(newTitle);
        entityRepository.save(entity);
        entityManager.flush();
        entityManager.clear();

        // Un 2e ajout après renommage (avec le NOUVEAU titre, comme le ferait un
        // utilisateur réel) doit rattacher le nouveau tome à l'édition "Kana" déjà
        // connue plutôt que d'en créer une seconde (scénario 5 : aucune duplication).
        quickAddService.addNewEntityWithOwnership(mangaTypeId, newTitle,
                OwnershipCondition.NEW, Map.of(), 2, "Kana");

        // Les Éditions restent rattachées (scénario 3), toujours exactement 2 - pas 3.
        List<MangaEdition> editionsAfterRename = mangaEditionRepository.findByEntityId(entityId);
        assertThat(editionsAfterRename).hasSize(2);
        MangaEdition kanaAfterRename = editionsAfterRename.stream()
                .filter(e -> e.editionName().equalsIgnoreCase("Kana")).findFirst().orElseThrow();
        assertThat(kanaAfterRename.id()).isEqualTo(kanaEditionId); // même ligne, pas une nouvelle

        // Les Tomes restent rattachés aux mêmes Éditions (scénario 4) : tome 1 ET
        // tome 2 pointent tous les deux vers CETTE MÊME MangaEdition "Kana".
        Entity reloaded = entityRepository.findById(entityId).orElseThrow();
        assertThat(reloaded.title()).isEqualTo(newTitle);
        Variant tome1 = reloaded.findVariantByLabel("Tome 1 — Kana").orElseThrow();
        Variant tome2 = reloaded.findVariantByLabel("Tome 2 — Kana").orElseThrow();
        assertThat(tome1.mangaEditionId()).isEqualTo(kanaEditionId);
        assertThat(tome2.mangaEditionId()).isEqualTo(kanaEditionId);
    }

    @Test
    void consultation_and_completeness_keep_working_after_a_series_is_renamed() {
        UUID mangaTypeId = EntityTypeFixtures.MANGA.id();
        String originalTitle = "Vinland Saga " + UUID.randomUUID();

        var result = quickAddService.addNewEntityWithOwnership(mangaTypeId, originalTitle,
                OwnershipCondition.NEW, Map.of(), 1, "Kurokawa");
        UUID entityId = result.entityId();
        MangaEdition edition = mangaEditionRepository.findByEntityIdAndEditionName(entityId, "Kurokawa").orElseThrow();
        mangaEditionRepository.save(edition.withUpdatedReferenceData(EditionTier.STANDARD, "Kurokawa", 27,
                new BigDecimal("7.90"), false, false, null));

        String newTitle = "Vinland Saga (renommé) " + UUID.randomUUID();
        Entity entity = entityRepository.findById(entityId).orElseThrow();
        entity.rename(newTitle);
        entityRepository.save(entity);
        entityManager.flush();
        entityManager.clear();

        // La consultation (recherche d'édition par ID) continue de fonctionner (scénario 6).
        Optional<MangaEdition> found = purchaseAnalysisService.findEdition(entityId, newTitle, "Kurokawa");
        assertThat(found).isPresent();
        assertThat(found.get().id()).isEqualTo(edition.id());

        // La complétude aussi (scénario 6) - toujours calculable après renommage,
        // avec le nombre de tomes connu conservé (27, jamais réinitialisé).
        CollectionStatus status = purchaseAnalysisService.computeCompleteness(entityId, newTitle, "Kurokawa", Set.of(1));
        assertThat(status.isKnown()).isTrue();
        assertThat(status.totalVolumes()).isEqualTo(27);
        assertThat(status.missingCount()).isEqualTo(26);
    }
}
