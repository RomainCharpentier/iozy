package com.iozycore.integration;

import com.iozycore.core.domain.catalog.Entity;
import com.iozycore.core.domain.catalog.EntityRepository;
import com.iozycore.core.domain.catalog.EntityTypeFixtures;
import com.iozycore.core.domain.catalog.Variant;
import com.iozycore.core.domain.ownership.Ownership;
import com.iozycore.core.domain.ownership.OwnershipCondition;
import com.iozycore.manga.domain.deals.CollectionStatus;
import com.iozycore.manga.domain.deals.CollectorPreferences;
import com.iozycore.manga.domain.deals.CollectorPreferencesRepository;
import com.iozycore.core.listing.ShippingEstimateKind;
import com.iozycore.manga.domain.deals.Condition;
import com.iozycore.manga.domain.deals.EditionSuggestion;
import com.iozycore.manga.domain.EditionTier;
import com.iozycore.core.listing.ListingPlatform;
import com.iozycore.manga.domain.MangaEdition;
import com.iozycore.manga.domain.MangaEditionRepository;
import com.iozycore.manga.domain.deals.MarketPriceObservation;
import com.iozycore.manga.domain.deals.MarketPriceObservationRepository;
import com.iozycore.manga.application.deals.PurchaseAnalysisService;
import com.iozycore.manga.application.deals.PurchaseAnalysisService.AnalyzeListingCommand;
import com.iozycore.manga.application.deals.PurchaseAnalysisService.AnalyzeListingItemCommand;
import com.iozycore.manga.application.deals.PurchaseAnalysisService.NearCompleteSuggestion;
import com.iozycore.manga.domain.deals.PurchaseAnalysis;
import com.iozycore.manga.domain.deals.VolumeRange;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

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
class PurchaseAnalysisPersistenceIntegrationTest extends PostgresIntegrationTest {

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
    private com.iozycore.core.domain.ownership.OwnershipRepository ownershipRepository;

    @Autowired
    private com.iozycore.core.application.QuickAddService quickAddService;

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
        // Step 7 (reuse the existing enrichment pipeline): an Edition created
        // through the quick add (QuickAddService, step 3) is a MangaEdition like any
        // other - the same PATCH /editions/{id} already used by the Purchase Analysis
        // works on it without distinction, no duplicated data and no separate pipeline.
        String seriesTitle = "Vinland Saga " + UUID.randomUUID();
        com.iozycore.core.application.QuickAddService.QuickAddResult result = quickAddService.addNewEntityWithOwnership(
                EntityTypeFixtures.MANGA.id(), seriesTitle, com.iozycore.core.domain.ownership.OwnershipCondition.NEW,
                Map.of(), 1, "Deluxe");

        MangaEdition created = mangaEditionRepository.findBySeriesAndEdition(seriesTitle, "Deluxe").orElseThrow();
        assertThat(created.entityId()).isEqualTo(result.entityId()); // linked from the creation (step 3)
        assertThat(created.tier()).isEqualTo(EditionTier.OTHER); // strict minimum, nothing guessed at creation
        assertThat(created.totalVolumes()).isNull();
        assertThat(created.publisher()).isNull();

        MangaEdition enriched = purchaseAnalysisService.updateEdition(created.id(), EditionTier.DELUXE,
                "Kurokawa", 10, new BigDecimal("19.90"), false, false, null);

        assertThat(enriched.entityId()).isEqualTo(result.entityId()); // the link to the Series survives the enrichment
        assertThat(enriched.publisher()).isEqualTo("Kurokawa");
        MangaEdition reloaded = mangaEditionRepository.findById(created.id()).orElseThrow();
        assertThat(reloaded.totalVolumes()).isEqualTo(10); // persisted
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
        // Before this guard, only the Postgres foreign key constraint
        // protected the table: the deletion raised a raw SQL error
        // (500) instead of the explicit refusal already planned for the volumes.
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

        CollectorPreferences updated = new CollectorPreferences(beforeAnySave.editionTierRanking(), true,
                com.iozycore.manga.domain.deals.WeightLevel.MEDIUM, 15, beforeAnySave.factorWeights());
        collectorPreferencesRepository.save(updated);

        CollectorPreferences reloaded = collectorPreferencesRepository.find();
        assertThat(reloaded.conditionImportance())
                .isEqualTo(com.iozycore.manga.domain.deals.WeightLevel.MEDIUM);
        assertThat(reloaded.minimumDiscountVsRetailPercent()).isEqualTo(15);
    }

    @Test
    void analyzing_a_listing_persists_a_full_history_entry_reloadable_by_id() {
        MangaEdition edition = mangaEditionRepository.save(MangaEdition.create("Vagabond " + UUID.randomUUID(),
                "VIZBIG Edition", EditionTier.INTEGRAL, "Kodansha", 3, new BigDecimal("25"), false, false, null));

        AnalyzeListingCommand command = new AnalyzeListingCommand(ListingPlatform.VINTED, null, "Vagabond lot",
                null, new BigDecimal("50"), BigDecimal.ZERO, ShippingEstimateKind.UNKNOWN, BigDecimal.ZERO, Condition.VERY_GOOD, false,
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
    void les_reserves_de_la_reference_traversent_le_jsonb_comme_le_prix() {
        // The freshness of the reference is the FIRST date of the payload: all the
        // rest of the snapshot is number, text or instant. A real round-trip
        // is the only place where this is checked - badly serialised, an
        // analysis could not be read again at all.
        MangaEdition edition = mangaEditionRepository.save(MangaEdition.create("Blame " + UUID.randomUUID(),
                "Master Edition", EditionTier.DELUXE, "Glénat", 6, new BigDecimal("22"), false, false, null));
        LocalDate plusRecent = LocalDate.now().minusDays(3);
        marketPriceObservationRepository.save(MarketPriceObservation.record_(edition.id(), new VolumeRange(1, 6),
                new BigDecimal("120"), ListingPlatform.VINTED, Condition.VERY_GOOD, LocalDate.now().minusDays(20), null));
        marketPriceObservationRepository.save(MarketPriceObservation.record_(edition.id(), new VolumeRange(1, 6),
                new BigDecimal("132"), ListingPlatform.VINTED, Condition.VERY_GOOD, plusRecent, null));

        PurchaseAnalysis analysis = purchaseAnalysisService.analyze(new AnalyzeListingCommand(
                ListingPlatform.VINTED, null, "Lot Blame", null, new BigDecimal("110"), BigDecimal.ZERO,
                ShippingEstimateKind.FREE, BigDecimal.ZERO, Condition.VERY_GOOD, false,
                List.of(new AnalyzeListingItemCommand(edition.seriesTitle(), edition.editionName(),
                        Set.of(1, 2, 3, 4, 5, 6), null)),
                List.of()));
        assertThat(analysis.assessment().referenceMostRecentObservation()).isEqualTo(plusRecent);

        entityManager.flush();
        entityManager.clear();

        var relue = purchaseAnalysisService.findAnalysisById(analysis.id()).orElseThrow().assessment();
        assertThat(relue.referenceMostRecentObservation()).isEqualTo(plusRecent);
        assertThat(relue.referenceExaminedCount()).isEqualTo(2);
        assertThat(relue.referenceSpreadPercent())
                .isEqualTo(analysis.assessment().referenceSpreadPercent());
    }

    @Test
    void un_port_saisi_a_la_main_se_relit_toujours_comme_une_estimation() {
        // The historical read must never promote an entry into a firm
        // price: "5.90 € estimated" today, "5.90 € estimated" in a year.
        MangaEdition edition = mangaEditionRepository.save(MangaEdition.create("Berserk " + UUID.randomUUID(),
                "Standard", EditionTier.STANDARD, "Glenat", 41, new BigDecimal("8.50"), false, false, null));

        AnalyzeListingCommand command = new AnalyzeListingCommand(ListingPlatform.VINTED, null, "Lot Berserk",
                null, new BigDecimal("10"), new BigDecimal("5.90"), null, new BigDecimal("1.20"),
                Condition.VERY_GOOD, false,
                List.of(new AnalyzeListingItemCommand(edition.seriesTitle(), edition.editionName(), Set.of(1), null)),
                List.of());

        PurchaseAnalysis analysis = purchaseAnalysisService.analyze(command);
        entityManager.flush();
        entityManager.clear();

        PurchaseAnalysis reloaded = purchaseAnalysisService.findAnalysisById(analysis.id()).orElseThrow();
        assertThat(reloaded.listing().shippingKind()).isEqualTo(ShippingEstimateKind.ESTIMATED);
        assertThat(reloaded.listing().totalRealCost()).isEqualByComparingTo("17.10");
        assertThat(reloaded.listing().acquisitionCostIncludesShipping()).isTrue();
        assertThat(reloaded.listing().acquisitionCostIsLowerBound()).isFalse();
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
        // No gemini.api-key in this test context (see application.yml) - checks that the
        // end-to-end Spring wiring (Service -> AiEditionAdvisor -> GeminiEditionAdvisor) stays
        // silent instead of failing, same rule as BGG/IGDB without credentials.
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
        entityRepository.save(entity); // the Series (and its Variants) must exist before an Ownership references them (FK)
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
        // Step 6 (Volume != Ownership model): a catalogued Variant without an active Ownership
        // (e.g. a copy sold and then its Ownership deleted, see OwnershipDeletionService)
        // must never inflate ownedCount nor silently disappear from missingVolumeNumbers -
        // and must be recognisable as "already catalogued" rather than purely virtual.
        String seriesTitle = "Parasyte " + UUID.randomUUID();
        mangaEditionRepository.save(MangaEdition.create(seriesTitle, "Standard", EditionTier.STANDARD, "Tonkam",
                10, new BigDecimal("7.50"), false, false, null));

        Entity entity = Entity.create(EntityTypeFixtures.MANGA.id(), seriesTitle);
        Variant owned1 = entity.addVariant("Tome 1", Map.of("volumeNumber", 1, "edition", "Standard"));
        Variant owned2 = entity.addVariant("Tome 2", Map.of("volumeNumber", 2, "edition", "Standard"));
        entity.addVariant("Tome 3", Map.of("volumeNumber", 3, "edition", "Standard")); // catalogued, never owned
        entityRepository.save(entity);
        ownershipRepository.save(Ownership.acquire(entity.id(), owned1.id(), OwnershipCondition.NEW, LocalDate.now(), null));
        ownershipRepository.save(Ownership.acquire(entity.id(), owned2.id(), OwnershipCondition.NEW, LocalDate.now(), null));
        // Volumes 4-10: purely virtual, no catalogued Variant at all.

        NearCompleteSuggestion suggestion = purchaseAnalysisService.findNearCompleteSuggestions().stream()
                .filter(s -> s.entityId().equals(entity.id())).findFirst().orElseThrow();

        assertThat(suggestion.ownedCount()).isEqualTo(2); // not 3
        assertThat(suggestion.missingCount()).isEqualTo(8); // volumes 3 to 10
        assertThat(suggestion.cataloguedMissingVolumeNumbers()).containsExactly(3); // catalogued, just not owned
        assertThat(suggestion.missingVolumeNumbers()).contains(3, 4, 10); // virtual AND catalogued, all "missing"
    }

    @Test
    void analyzing_a_listing_flags_volumes_already_owned_in_the_real_collection_as_duplicates() {
        String seriesTitle = "My Home Hero " + UUID.randomUUID();
        Entity entity = Entity.create(EntityTypeFixtures.MANGA.id(), seriesTitle);
        entity.addVariant("Tome 1", Map.of("volumeNumber", 1, "edition", "Standard"));
        entity.addVariant("Tome 2", Map.of("volumeNumber", 2, "edition", "Standard"));
        entityRepository.save(entity);

        ownershipRepository.save(com.iozycore.core.domain.ownership.Ownership.acquire(entity.id(),
                entity.findVariantByLabel("Tome 1").orElseThrow().id(),
                com.iozycore.core.domain.ownership.OwnershipCondition.NEW, LocalDate.now(), null));
        ownershipRepository.save(com.iozycore.core.domain.ownership.Ownership.acquire(entity.id(),
                entity.findVariantByLabel("Tome 2").orElseThrow().id(),
                com.iozycore.core.domain.ownership.OwnershipCondition.NEW, LocalDate.now(), null));

        AnalyzeListingCommand command = new AnalyzeListingCommand(ListingPlatform.VINTED, null, "Lot avec doublons",
                null, new BigDecimal("15"), BigDecimal.ZERO, ShippingEstimateKind.UNKNOWN, BigDecimal.ZERO, Condition.GOOD, false,
                List.of(new AnalyzeListingItemCommand(seriesTitle, "Standard", Set.of(1, 2, 3), null)),
                List.of());

        PurchaseAnalysis analysis = purchaseAnalysisService.analyze(command);

        com.iozycore.manga.domain.deals.DuplicateAnalysis duplicates = analysis.itemBreakdown().get(0).duplicates();
        assertThat(duplicates.duplicateVolumeNumbers()).containsExactlyInAnyOrder(1, 2);
        assertThat(duplicates.usefulVolumeCount()).isEqualTo(1);
    }

    /**
     * A catalogued volume WITHOUT a specified edition belongs to the only named edition of
     * the series - this is what the detail page and My collection have always shown, through
     * the grouping of CollectionProgressService.
     * <p>
     * The analysis of a batch required an EXACT match of the {@code edition}
     * attribute: so it announced as "missing" a volume that was on the shelf,
     * and advised to buy it again. Found while testing the journey on 2026-08-27 with
     * a Naruto whose volume 1 has no edition filled in.
     */
    @Test
    void a_volume_catalogued_without_an_edition_still_counts_as_owned_in_the_only_named_edition() {
        String seriesTitle = "Naruto " + UUID.randomUUID();
        Entity entity = Entity.create(EntityTypeFixtures.MANGA.id(), seriesTitle);
        // Volume 1 without edition, the two others in "Kana": exactly the shape
        // that an old add leaves behind.
        entity.addVariant("Tome 1", Map.of("volumeNumber", 1));
        entity.addVariant("Tome 2 — Kana", Map.of("volumeNumber", 2, "edition", "Kana"));
        entityRepository.save(entity);

        ownershipRepository.save(Ownership.acquire(entity.id(),
                entity.findVariantByLabel("Tome 1").orElseThrow().id(),
                OwnershipCondition.NEW, LocalDate.now(), null));
        ownershipRepository.save(Ownership.acquire(entity.id(),
                entity.findVariantByLabel("Tome 2 — Kana").orElseThrow().id(),
                OwnershipCondition.NEW, LocalDate.now(), null));

        AnalyzeListingCommand command = new AnalyzeListingCommand(ListingPlatform.VINTED, null, "Lot Naruto 1-3",
                null, new BigDecimal("30"), BigDecimal.ZERO, ShippingEstimateKind.UNKNOWN, BigDecimal.ZERO,
                Condition.VERY_GOOD, false,
                List.of(new AnalyzeListingItemCommand(seriesTitle, "Kana", Set.of(1, 2, 3), null)),
                List.of());

        PurchaseAnalysis analysis = purchaseAnalysisService.analyze(command);

        var duplicates = analysis.itemBreakdown().get(0).duplicates();
        // Volume 1 counts as already owned despite its missing edition; only 3
        // is really useful in this batch.
        assertThat(duplicates.duplicateVolumeNumbers()).containsExactlyInAnyOrder(1, 2);
        assertThat(duplicates.usefulVolumeCount()).isEqualTo(1);
    }

    // --- Migration "Series -> Edition by ID" (history of the conversation) ---
    // The title must never again be the persistent relation between a Series and
    // its Editions: a rename must be able to change ONLY Entity.title
    // without breaking or duplicating anything on the MangaEdition/Variant side.

    @Test
    void renaming_a_series_does_not_orphan_or_duplicate_its_editions_or_tomes() {
        UUID mangaTypeId = EntityTypeFixtures.MANGA.id();
        String originalTitle = "Naruto " + UUID.randomUUID();

        // Series with SEVERAL Editions (scenario 1): volume 1 of "Kana", volume 1 of
        // "Perfect Edition" - two distinct MangaEditions, both linked by
        // entityId (see resolveOrCreateMangaEdition, never a duplicate).
        var kanaTome1 = quickAddService.addNewEntityWithOwnership(mangaTypeId, originalTitle,
                OwnershipCondition.NEW, Map.of(), 1, "Kana");
        quickAddService.addNewEntityWithOwnership(mangaTypeId, originalTitle,
                OwnershipCondition.NEW, Map.of(), 1, "Perfect Edition");
        UUID entityId = kanaTome1.entityId();

        List<MangaEdition> editionsBeforeRename = mangaEditionRepository.findByEntityId(entityId);
        assertThat(editionsBeforeRename).hasSize(2);
        UUID kanaEditionId = editionsBeforeRename.stream()
                .filter(e -> e.editionName().equalsIgnoreCase("Kana")).findFirst().orElseThrow().id();

        // Rename (scenario 2): ONLY Entity.title, nothing on the MangaEdition side.
        String newTitle = "L'Histoire de Naruto " + UUID.randomUUID();
        Entity entity = entityRepository.findById(entityId).orElseThrow();
        entity.rename(newTitle);
        entityRepository.save(entity);
        entityManager.flush();
        entityManager.clear();

        // A 2nd add after the rename (with the NEW title, as a real
        // user would do) must attach the new volume to the "Kana" edition already
        // known instead of creating a second one (scenario 5: no duplication).
        quickAddService.addNewEntityWithOwnership(mangaTypeId, newTitle,
                OwnershipCondition.NEW, Map.of(), 2, "Kana");

        // The Editions stay attached (scenario 3), still exactly 2 - not 3.
        List<MangaEdition> editionsAfterRename = mangaEditionRepository.findByEntityId(entityId);
        assertThat(editionsAfterRename).hasSize(2);
        MangaEdition kanaAfterRename = editionsAfterRename.stream()
                .filter(e -> e.editionName().equalsIgnoreCase("Kana")).findFirst().orElseThrow();
        assertThat(kanaAfterRename.id()).isEqualTo(kanaEditionId); // same row, not a new one

        // The Volumes stay attached to the same Editions (scenario 4): volume 1 AND
        // volume 2 both point to THIS SAME MangaEdition "Kana".
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

        // The read (search of an edition by ID) still works (scenario 6).
        Optional<MangaEdition> found = purchaseAnalysisService.findEdition(entityId, newTitle, "Kurokawa");
        assertThat(found).isPresent();
        assertThat(found.get().id()).isEqualTo(edition.id());

        // The completeness too (scenario 6) - still computable after the rename,
        // with the known number of volumes kept (27, never reset).
        CollectionStatus status = purchaseAnalysisService.computeCompleteness(entityId, newTitle, "Kurokawa", Set.of(1));
        assertThat(status.isKnown()).isTrue();
        assertThat(status.totalVolumes()).isEqualTo(27);
        assertThat(status.missingCount()).isEqualTo(26);
    }
}
