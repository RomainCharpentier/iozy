package com.iozycore.core.application;

import com.iozycore.manga.domain.EditionTier;
import com.iozycore.core.domain.catalog.Entity;
import com.iozycore.core.domain.catalog.EntityTypeFixtures;
import com.iozycore.manga.domain.MangaEdition;
import com.iozycore.core.domain.catalog.Variant;
import com.iozycore.core.domain.ownership.OwnershipCondition;
import org.junit.jupiter.api.Test;
import com.iozycore.core.testing.InMemoryEntityRepository;
import com.iozycore.core.testing.InMemoryOwnershipRepository;
import com.iozycore.core.testing.InMemoryWishlistEntryRepository;
import com.iozycore.manga.testing.InMemoryMangaEditionRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import com.iozycore.manga.MangaEditionLinker;

/**
 * Checks the deduplication of quick add (UC1, step 6) with fake in-memory
 * repositories - no need for Spring or PostgreSQL to
 * test this application rule.
 */
class QuickAddServiceTest {

    @Test
    void first_quick_add_creates_a_new_entity() {
        QuickAddService service = newService();

        QuickAddService.QuickAddResult result = service.addNewEntityWithOwnership(
                EntityTypeFixtures.MANGA.id(), "Death Note - Tome 1", OwnershipCondition.NEW);

        assertThat(result.matchedExistingEntity()).isFalse();
    }

    @Test
    void re_adding_the_exact_same_title_reuses_the_existing_entity_instead_of_duplicating_it() {
        InMemoryEntityRepository entityRepository = new InMemoryEntityRepository();
        InMemoryOwnershipRepository ownershipRepository = new InMemoryOwnershipRepository();
        QuickAddService service = new QuickAddService(entityRepository, ownershipRepository,
                new CatalogEntityResolver(entityRepository),
                new TomeResolver(entityRepository, List.of(), List.of(new MangaEditionLinker(new InMemoryMangaEditionRepository()))), new InMemoryWishlistEntryRepository(), event -> {
        });

        QuickAddService.QuickAddResult first = service.addNewEntityWithOwnership(
                EntityTypeFixtures.MANGA.id(), "Death Note - Tome 1", OwnershipCondition.NEW);
        // Different case on purpose, to check the case-insensitive match.
        QuickAddService.QuickAddResult second = service.addNewEntityWithOwnership(
                EntityTypeFixtures.MANGA.id(), "death note - tome 1", OwnershipCondition.USED);

        assertThat(second.matchedExistingEntity()).isTrue();
        assertThat(second.entityId()).isEqualTo(first.entityId());
        assertThat(entityRepository.count()).isEqualTo(1); // no duplicate in the Catalog
        assertThat(ownershipRepository.findByEntityId(first.entityId())).hasSize(2); // 2 distinct copies
    }

    @Test
    void a_different_title_never_matches_an_existing_entity() {
        QuickAddService service = newService();

        QuickAddService.QuickAddResult first = service.addNewEntityWithOwnership(
                EntityTypeFixtures.MANGA.id(), "Death Note - Tome 1", OwnershipCondition.NEW);
        QuickAddService.QuickAddResult second = service.addNewEntityWithOwnership(
                EntityTypeFixtures.MANGA.id(), "Death Note - Tome 2", OwnershipCondition.NEW);

        assertThat(second.matchedExistingEntity()).isFalse();
        assertThat(second.entityId()).isNotEqualTo(first.entityId());
    }

    @Test
    void prefilled_attributes_never_overwrite_attributes_already_set_on_a_matched_entity() {
        InMemoryEntityRepository repo = new InMemoryEntityRepository();
        QuickAddService service = new QuickAddService(repo, new InMemoryOwnershipRepository(),
                new CatalogEntityResolver(repo),
                new TomeResolver(repo, List.of(), List.of(new MangaEditionLinker(new InMemoryMangaEditionRepository()))), new InMemoryWishlistEntryRepository(), event -> {
        });

        service.addNewEntityWithOwnership(EntityTypeFixtures.MANGA.id(), "Death Note - Tome 1", OwnershipCondition.NEW,
                Map.of("mangaka", "Saisie manuelle"));
        service.addNewEntityWithOwnership(EntityTypeFixtures.MANGA.id(), "Death Note - Tome 1", OwnershipCondition.NEW,
                Map.of("mangaka", "Ohba, Tsugumi", "publisher", "Kana"));

        Entity entity = repo.findByTypeAndTitle(EntityTypeFixtures.MANGA.id(), "Death Note - Tome 1").orElseThrow();
        assertThat(entity.attributes()).containsEntry("mangaka", "Saisie manuelle"); // not overwritten
        assertThat(entity.attributes()).containsEntry("publisher", "Kana"); // completed
    }

    @Test
    void adding_two_different_volume_numbers_of_the_same_series_creates_two_variants_on_one_entity() {
        InMemoryEntityRepository entityRepository = new InMemoryEntityRepository();
        InMemoryOwnershipRepository ownershipRepository = new InMemoryOwnershipRepository();
        QuickAddService service = new QuickAddService(entityRepository, ownershipRepository,
                new CatalogEntityResolver(entityRepository),
                new TomeResolver(entityRepository, List.of(), List.of(new MangaEditionLinker(new InMemoryMangaEditionRepository()))), new InMemoryWishlistEntryRepository(), event -> {
        });

        QuickAddService.QuickAddResult tome1 = service.addNewEntityWithOwnership(
                EntityTypeFixtures.MANGA.id(), "Death Note", OwnershipCondition.NEW, Map.of(), 1, null);
        QuickAddService.QuickAddResult tome2 = service.addNewEntityWithOwnership(
                EntityTypeFixtures.MANGA.id(), "Death Note", OwnershipCondition.NEW, Map.of(), 2, null);

        assertThat(tome1.entityId()).isEqualTo(tome2.entityId()); // same series, a single detail page
        assertThat(tome1.variantId()).isNotEqualTo(tome2.variantId()); // two distinct volumes
        assertThat(tome1.matchedExistingVariant()).isFalse();
        assertThat(tome2.matchedExistingVariant()).isFalse();

        Entity entity = entityRepository.findById(tome1.entityId()).orElseThrow();
        assertThat(entity.variants()).hasSize(2);
        assertThat(ownershipRepository.findByEntityId(entity.id())).hasSize(2);
    }

    @Test
    void re_adding_the_same_volume_number_reuses_the_variant_and_flags_it_as_already_owned() {
        InMemoryEntityRepository entityRepository = new InMemoryEntityRepository();
        InMemoryOwnershipRepository ownershipRepository = new InMemoryOwnershipRepository();
        QuickAddService service = new QuickAddService(entityRepository, ownershipRepository,
                new CatalogEntityResolver(entityRepository),
                new TomeResolver(entityRepository, List.of(), List.of(new MangaEditionLinker(new InMemoryMangaEditionRepository()))), new InMemoryWishlistEntryRepository(), event -> {
        });

        QuickAddService.QuickAddResult first = service.addNewEntityWithOwnership(
                EntityTypeFixtures.MANGA.id(), "Death Note", OwnershipCondition.NEW, Map.of(), 3, null);
        QuickAddService.QuickAddResult second = service.addNewEntityWithOwnership(
                EntityTypeFixtures.MANGA.id(), "Death Note", OwnershipCondition.NEW, Map.of(), 3, null);

        assertThat(second.variantId()).isEqualTo(first.variantId()); // same volume, no duplicate Variant
        assertThat(second.matchedExistingVariant()).isTrue();

        Entity entity = entityRepository.findById(first.entityId()).orElseThrow();
        assertThat(entity.variants()).hasSize(1); // a single "Tome 3", not two
    }

    @Test
    void same_volume_number_with_a_different_edition_is_a_distinct_variant() {
        InMemoryEntityRepository entityRepository = new InMemoryEntityRepository();
        InMemoryMangaEditionRepository mangaEditionRepository = new InMemoryMangaEditionRepository();
        QuickAddService service = new QuickAddService(entityRepository, new InMemoryOwnershipRepository(),
                new CatalogEntityResolver(entityRepository),
                new TomeResolver(entityRepository, List.of(), List.of(new MangaEditionLinker(mangaEditionRepository))), new InMemoryWishlistEntryRepository(), event -> {
        });

        QuickAddService.QuickAddResult pika = service.addNewEntityWithOwnership(
                EntityTypeFixtures.MANGA.id(), "Death Note", OwnershipCondition.NEW, Map.of(), 1, "Pika");
        QuickAddService.QuickAddResult perfectEdition = service.addNewEntityWithOwnership(
                EntityTypeFixtures.MANGA.id(), "Death Note", OwnershipCondition.NEW, Map.of(), 1, "Perfect Edition");

        assertThat(pika.variantId()).isNotEqualTo(perfectEdition.variantId());
        Entity entity = entityRepository.findById(pika.entityId()).orElseThrow();
        assertThat(entity.variants()).hasSize(2);

        // Each distinct edition is also linked to its own catalog Edition -
        // no duplicate, but not a single shared mangaEditionId for both either.
        UUID pikaEditionId = variantById(entity, pika.variantId()).mangaEditionId();
        UUID perfectEditionId = variantById(entity, perfectEdition.variantId()).mangaEditionId();
        assertThat(pikaEditionId).isNotNull();
        assertThat(perfectEditionId).isNotNull();
        assertThat(pikaEditionId).isNotEqualTo(perfectEditionId);
        assertThat(mangaEditionRepository.count()).isEqualTo(2);
    }

    @Test
    void adding_the_same_edition_twice_reuses_the_same_manga_edition_never_a_duplicate() {
        InMemoryEntityRepository entityRepository = new InMemoryEntityRepository();
        InMemoryMangaEditionRepository mangaEditionRepository = new InMemoryMangaEditionRepository();
        QuickAddService service = new QuickAddService(entityRepository, new InMemoryOwnershipRepository(),
                new CatalogEntityResolver(entityRepository),
                new TomeResolver(entityRepository, List.of(), List.of(new MangaEditionLinker(mangaEditionRepository))), new InMemoryWishlistEntryRepository(), event -> {
        });

        QuickAddService.QuickAddResult tome1 = service.addNewEntityWithOwnership(
                EntityTypeFixtures.MANGA.id(), "Death Note", OwnershipCondition.NEW, Map.of(), 1, "Perfect Edition");
        QuickAddService.QuickAddResult tome2 = service.addNewEntityWithOwnership(
                EntityTypeFixtures.MANGA.id(), "Death Note", OwnershipCondition.NEW, Map.of(), 2, "Perfect Edition");

        Entity entity = entityRepository.findById(tome1.entityId()).orElseThrow();
        UUID edition1 = variantById(entity, tome1.variantId()).mangaEditionId();
        UUID edition2 = variantById(entity, tome2.variantId()).mangaEditionId();
        assertThat(edition1).isEqualTo(edition2); // same edition, not a duplicate per volume
        assertThat(mangaEditionRepository.count()).isEqualTo(1);
    }

    @Test
    void no_edition_means_no_manga_edition_is_created_or_linked() {
        InMemoryEntityRepository entityRepository = new InMemoryEntityRepository();
        InMemoryMangaEditionRepository mangaEditionRepository = new InMemoryMangaEditionRepository();
        QuickAddService service = new QuickAddService(entityRepository, new InMemoryOwnershipRepository(),
                new CatalogEntityResolver(entityRepository),
                new TomeResolver(entityRepository, List.of(), List.of(new MangaEditionLinker(mangaEditionRepository))), new InMemoryWishlistEntryRepository(), event -> {
        });

        QuickAddService.QuickAddResult result = service.addNewEntityWithOwnership(
                EntityTypeFixtures.MANGA.id(), "Death Note", OwnershipCondition.NEW, Map.of(), 5, null);

        Entity entity = entityRepository.findById(result.entityId()).orElseThrow();
        assertThat(variantById(entity, result.variantId()).mangaEditionId()).isNull();
        assertThat(mangaEditionRepository.count()).isZero();
    }

    @Test
    void an_existing_manga_edition_not_yet_linked_to_this_series_gets_linked_opportunistically() {
        InMemoryEntityRepository entityRepository = new InMemoryEntityRepository();
        InMemoryMangaEditionRepository mangaEditionRepository = new InMemoryMangaEditionRepository();
        // Simulates an Edition already known through the Purchase Analysis, before "Death Note"
        // is in the collection (entityId still null at this point).
        MangaEdition preExisting = mangaEditionRepository.save(MangaEdition.create(
                "Death Note", "Perfect Edition", EditionTier.DELUXE, "Kana", 6, null, false, false, null));
        QuickAddService service = new QuickAddService(entityRepository, new InMemoryOwnershipRepository(),
                new CatalogEntityResolver(entityRepository),
                new TomeResolver(entityRepository, List.of(), List.of(new MangaEditionLinker(mangaEditionRepository))), new InMemoryWishlistEntryRepository(), event -> {
        });

        QuickAddService.QuickAddResult result = service.addNewEntityWithOwnership(
                EntityTypeFixtures.MANGA.id(), "Death Note", OwnershipCondition.NEW, Map.of(), 1, "Perfect Edition");

        Entity entity = entityRepository.findById(result.entityId()).orElseThrow();
        assertThat(variantById(entity, result.variantId()).mangaEditionId()).isEqualTo(preExisting.id());
        assertThat(mangaEditionRepository.count()).isEqualTo(1); // reused, not duplicated
        assertThat(mangaEditionRepository.findById(preExisting.id()).orElseThrow().entityId())
                .isEqualTo(result.entityId()); // linked afterwards, never guessed before
    }

    private static Variant variantById(Entity entity, UUID variantId) {
        return entity.variants().stream().filter(v -> v.id().equals(variantId)).findFirst().orElseThrow();
    }

    @Test
    void no_volume_number_means_no_variant_at_all_legacy_behavior() {
        QuickAddService service = newService();

        QuickAddService.QuickAddResult result = service.addNewEntityWithOwnership(
                EntityTypeFixtures.MANGA.id(), "Death Note", OwnershipCondition.NEW);

        assertThat(result.variantId()).isNull();
        assertThat(result.matchedExistingVariant()).isFalse();
    }

    @Test
    void une_date_d_acquisition_fournie_est_respectee_plutot_que_remplacee_par_aujourd_hui() {
        // The only use: undoing a volume removal. Without this field, the undo
        // added the copy back WITH TODAY'S DATE, erasing the real acquisition
        // date - seen on 2026-08-28 on a volume moved from 26/08 to
        // 28/08 after a round trip. An undo that damages what it
        // restores restores nothing.
        InMemoryEntityRepository entityRepository = new InMemoryEntityRepository();
        InMemoryOwnershipRepository ownershipRepository = new InMemoryOwnershipRepository();
        QuickAddService service = new QuickAddService(entityRepository, ownershipRepository,
                new CatalogEntityResolver(entityRepository),
                new TomeResolver(entityRepository, List.of(), List.of(new MangaEditionLinker(new InMemoryMangaEditionRepository()))),
                new InMemoryWishlistEntryRepository(), event -> {
                });
        LocalDate origine = LocalDate.of(2026, 8, 26);

        QuickAddService.QuickAddResult resultat = service.addNewEntityWithOwnership(
                EntityTypeFixtures.MANGA.id(), "Death Note", OwnershipCondition.NEW, Map.of(), 2, "Black Edition",
                null, null, origine);

        assertThat(ownershipRepository.findByEntityId(resultat.entityId()))
                .singleElement()
                .satisfies(o -> assertThat(o.acquiredAt()).isEqualTo(origine));
    }

    @Test
    void sans_date_fournie_l_ajout_reste_date_d_aujourd_hui() {
        InMemoryEntityRepository entityRepository = new InMemoryEntityRepository();
        InMemoryOwnershipRepository ownershipRepository = new InMemoryOwnershipRepository();
        QuickAddService service = new QuickAddService(entityRepository, ownershipRepository,
                new CatalogEntityResolver(entityRepository),
                new TomeResolver(entityRepository, List.of(), List.of(new MangaEditionLinker(new InMemoryMangaEditionRepository()))),
                new InMemoryWishlistEntryRepository(), event -> {
                });

        QuickAddService.QuickAddResult resultat = service.addNewEntityWithOwnership(
                EntityTypeFixtures.MANGA.id(), "Naruto", OwnershipCondition.NEW);

        assertThat(ownershipRepository.findByEntityId(resultat.entityId()))
                .singleElement()
                .satisfies(o -> assertThat(o.acquiredAt()).isEqualTo(LocalDate.now()));
    }

    private QuickAddService newService() {
        InMemoryEntityRepository entityRepository = new InMemoryEntityRepository();
        return new QuickAddService(entityRepository, new InMemoryOwnershipRepository(),
                new CatalogEntityResolver(entityRepository),
                new TomeResolver(entityRepository, List.of(), List.of(new MangaEditionLinker(new InMemoryMangaEditionRepository()))), new InMemoryWishlistEntryRepository(), event -> {
        });
    }
}
