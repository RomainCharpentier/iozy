package com.iozycore.integration;

import com.iozycore.core.application.EntityDeletionService;
import com.iozycore.core.application.VariantDeletionService;
import com.iozycore.manga.domain.EditionTier;
import com.iozycore.core.domain.catalog.Entity;
import com.iozycore.core.domain.catalog.EntityRepository;
import com.iozycore.core.domain.catalog.EntityTypeFixtures;
import com.iozycore.manga.domain.MangaEdition;
import com.iozycore.manga.domain.MangaEditionRepository;
import com.iozycore.core.domain.catalog.Tag;
import com.iozycore.core.domain.catalog.TagRepository;
import com.iozycore.core.domain.catalog.Variant;
import com.iozycore.core.domain.ownership.Ownership;
import com.iozycore.core.domain.ownership.OwnershipCondition;
import com.iozycore.core.domain.ownership.OwnershipRepository;
import com.iozycore.core.domain.shared.EntityDeletionNotAllowedException;
import com.iozycore.core.domain.shared.VariantDeletionNotAllowedException;
import com.iozycore.core.listing.ListingPlatform;
import com.iozycore.manga.deals.MarketPriceObservation;
import com.iozycore.manga.deals.MarketPriceObservationRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Checks that the persistence module (Flyway + JPA) really works
 * against a real PostgreSQL, not only against the in-memory domain.
 * Covers the scenario UC1 → UC2 → UC5: creation of an Entity, adding a
 * Tag, adding an Ownership, then checking that an Entity loaded
 * from the database carries its Variant/Tag/Ownership correctly.
 *
 * @Transactional isolates each method: the repositories (themselves
 * @Transactional, propagation REQUIRED) join the transaction opened
 * by the test instead of opening a new one, and Spring rolls it back at the
 * end of each method - without it the 3 methods share the same
 * static Postgres container and pollute each other's
 * results (seen: the tag filter also returned an Entity created
 * by a previous method).
 */
class EntityPersistenceIntegrationTest extends PostgresIntegrationTest {


    @Autowired
    private EntityRepository entityRepository;

    @Autowired
    private OwnershipRepository ownershipRepository;

    @Autowired
    private TagRepository tagRepository;

    @Autowired
    private MangaEditionRepository mangaEditionRepository;

    @Autowired
    private VariantDeletionService variantDeletionService;

    @Autowired
    private MarketPriceObservationRepository marketPriceObservationRepository;

    @Autowired
    private EntityDeletionService entityDeletionService;

    @Test
    void an_entity_can_be_saved_reloaded_with_its_variant_and_tag() {
        Entity entity = Entity.create(EntityTypeFixtures.MANGA.id(), "Death Note");
        entity.addVariant("Black Edition", java.util.Map.of("volumeCount", 6));

        Tag tag = tagRepository.save(new Tag(UUID.randomUUID(), "seinen"));
        entity.addTag(tag.id());

        entityRepository.save(entity);

        Entity reloaded = entityRepository.findById(entity.id()).orElseThrow();

        assertThat(reloaded.title()).isEqualTo("Death Note");
        assertThat(reloaded.variants()).hasSize(1);
        assertThat(reloaded.variants().get(0).label()).isEqualTo("Black Edition");
        assertThat(reloaded.tagIds()).containsExactly(tag.id());
    }

    @Test
    void an_ownership_can_be_acquired_then_marked_sold_and_reloaded() {
        Entity entity = Entity.create(EntityTypeFixtures.VIDEO_GAME.id(), "Hollow Knight");
        entityRepository.save(entity);

        Ownership ownership = Ownership.acquire(entity.id(), null, OwnershipCondition.NEW, LocalDate.now(), null);
        ownershipRepository.save(ownership);

        Ownership reloaded = ownershipRepository.findById(ownership.id()).orElseThrow();
        reloaded.markSold();
        ownershipRepository.save(reloaded);

        Ownership afterSale = ownershipRepository.findById(ownership.id()).orElseThrow();
        assertThat(afterSale.isActive()).isFalse();
        assertThat(ownershipRepository.existsByEntityId(entity.id())).isTrue(); // still exists, just sold
    }

    @Test
    void purchase_price_is_null_by_default_and_can_be_set_then_cleared_after_reload() {
        Entity entity = Entity.create(EntityTypeFixtures.MANGA.id(), "Vagabond " + UUID.randomUUID());
        entityRepository.save(entity);

        Ownership ownership = Ownership.acquire(entity.id(), null, OwnershipCondition.NEW, LocalDate.now(), null);
        ownershipRepository.save(ownership);

        assertThat(ownershipRepository.findById(ownership.id()).orElseThrow().purchasePrice()).isEmpty();

        Ownership reloaded = ownershipRepository.findById(ownership.id()).orElseThrow();
        reloaded.updatePurchasePrice(new BigDecimal("6.90"));
        ownershipRepository.save(reloaded);

        assertThat(ownershipRepository.findById(ownership.id()).orElseThrow().purchasePrice())
                .contains(new BigDecimal("6.90"));

        Ownership cleared = ownershipRepository.findById(ownership.id()).orElseThrow();
        cleared.updatePurchasePrice(null);
        ownershipRepository.save(cleared);

        assertThat(ownershipRepository.findById(ownership.id()).orElseThrow().purchasePrice()).isEmpty();
    }

    @Test
    void merged_variant_attributes_persist_after_reload() {
        Entity entity = Entity.create(EntityTypeFixtures.MANGA.id(), "Death Note " + UUID.randomUUID());
        Variant variant = entity.addVariant("Tome 1", Map.of("volumeNumber", 1, "edition", "Black Edition"));
        entityRepository.save(entity);

        Entity reloaded = entityRepository.findById(entity.id()).orElseThrow();
        reloaded.mergeVariantAttributes(variant.id(), Map.of("coverImageUrl", "https://example.com/tome1.jpg"));
        entityRepository.save(reloaded);

        Entity afterMerge = entityRepository.findById(entity.id()).orElseThrow();
        Variant updatedVariant = afterMerge.variants().get(0);
        assertThat(updatedVariant.attributes()).containsEntry("coverImageUrl", "https://example.com/tome1.jpg");
        assertThat(updatedVariant.attributes()).containsEntry("volumeNumber", 1); // kept, not overwritten
        assertThat(updatedVariant.attributes()).containsEntry("edition", "Black Edition");
    }

    @Test
    void a_variant_linked_to_a_manga_edition_persists_the_link_after_reload() {
        MangaEdition edition = mangaEditionRepository.save(MangaEdition.create("Death Note " + UUID.randomUUID(),
                "Black Edition", EditionTier.DELUXE, "Kana", 6, new BigDecimal("14.90"), false, false, null));
        Entity entity = Entity.create(EntityTypeFixtures.MANGA.id(), "Death Note " + UUID.randomUUID());
        Variant variant = entity.addVariant("Tome 1", Map.of("volumeNumber", 1, "edition", "Black Edition"));
        entityRepository.save(entity);

        Entity reloaded = entityRepository.findById(entity.id()).orElseThrow();
        assertThat(reloaded.variants().get(0).mangaEditionId()).isNull(); // not linked yet

        reloaded.linkVariantToEdition(variant.id(), edition.id());
        entityRepository.save(reloaded);

        Entity afterLink = entityRepository.findById(entity.id()).orElseThrow();
        assertThat(afterLink.variants().get(0).mangaEditionId()).isEqualTo(edition.id());
    }

    @Test
    void an_unreferenced_variant_can_be_deleted_and_a_sibling_variant_keeps_the_entity_alive() {
        // A second volume keeps the Series non-empty, to isolate this test from the cascade
        // "0 volume -> deletion of the Series" (see deleting_the_last_tome_of_a_series_... below).
        Entity entity = Entity.create(EntityTypeFixtures.MANGA.id(), "Death Note " + UUID.randomUUID());
        Variant variant = entity.addVariant("Tome 1", Map.of("volumeNumber", 1));
        entity.addVariant("Tome 2", Map.of("volumeNumber", 2));
        entityRepository.save(entity);

        variantDeletionService.delete(entity.id(), variant.id());

        Entity reloaded = entityRepository.findById(entity.id()).orElseThrow();
        assertThat(reloaded.variants()).extracting(Variant::label).containsExactly("Tome 2");
    }

    @Test
    void a_variant_referenced_by_a_real_ownership_row_cannot_be_deleted() {
        // Real round-trip: without the application guard, the FK constraint
        // ownership.variant_id (V1__init_schema.sql, without ON DELETE) would reject
        // the deletion with a raw SQL error instead of a clear message.
        Entity entity = Entity.create(EntityTypeFixtures.MANGA.id(), "Death Note " + UUID.randomUUID());
        Variant variant = entity.addVariant("Tome 1", Map.of("volumeNumber", 1));
        entityRepository.save(entity);
        ownershipRepository.save(Ownership.acquire(entity.id(), variant.id(), OwnershipCondition.NEW, LocalDate.now(), null));

        assertThatThrownBy(() -> variantDeletionService.delete(entity.id(), variant.id()))
                .isInstanceOf(VariantDeletionNotAllowedException.class);

        Entity reloaded = entityRepository.findById(entity.id()).orElseThrow();
        assertThat(reloaded.variants()).hasSize(1); // still there
    }

    @Test
    void deleting_the_last_tome_of_an_edition_cascades_all_the_way_to_the_series_for_real() {
        // Real end-to-end round-trip (step 5): Edition AND Series really absent
        // from the database afterwards, not only from the in-memory domain.
        Entity entity = Entity.create(EntityTypeFixtures.MANGA.id(), "Death Note " + UUID.randomUUID());
        Variant variant = entity.addVariant("Tome 1", Map.of("volumeNumber", 1));
        entityRepository.save(entity); // the Series must exist before an Edition can reference it (FK)
        MangaEdition edition = mangaEditionRepository.save(MangaEdition.create(entity.id(), entity.title(),
                "Perfect Edition", EditionTier.DELUXE, "Kana", 6, null, false, false, null));
        entity.linkVariantToEdition(variant.id(), edition.id());
        entityRepository.save(entity);

        variantDeletionService.delete(entity.id(), variant.id());

        assertThat(mangaEditionRepository.findById(edition.id())).isEmpty();
        assertThat(entityRepository.findById(entity.id())).isEmpty();
    }

    @Test
    void a_manga_edition_with_a_real_market_observation_survives_losing_its_last_tome() {
        // Proof by the real FK constraint (market_price_observation.manga_edition_id):
        // without catching DataIntegrityViolationException in VariantDeletionService,
        // this call would throw a raw SQL error instead of simply keeping
        // the Edition as reference data.
        Entity entity = Entity.create(EntityTypeFixtures.MANGA.id(), "Sanctuary " + UUID.randomUUID());
        Variant variant = entity.addVariant("Tome 1", Map.of("volumeNumber", 1));
        entityRepository.save(entity); // the Series must exist before an Edition can reference it (FK)
        MangaEdition edition = mangaEditionRepository.save(MangaEdition.create(entity.id(), entity.title(),
                "Perfect Edition", EditionTier.PERFECT, "Glénat", 6, null, false, false, null));
        entity.linkVariantToEdition(variant.id(), edition.id());
        entityRepository.save(entity);
        marketPriceObservationRepository.save(MarketPriceObservation.record_(edition.id(), null,
                new BigDecimal("150"), ListingPlatform.VINTED, null, LocalDate.now(), "Lot Vinted"));

        variantDeletionService.delete(entity.id(), variant.id()); // throws nothing

        assertThat(mangaEditionRepository.findById(edition.id())).isPresent(); // kept
        Entity reloaded = entityRepository.findById(entity.id()).orElseThrow();
        assertThat(reloaded.variants()).isEmpty(); // the Volume itself is really gone

        // The Series also stays (the cascade stopped), and an attempt to delete
        // the Series directly is blocked with a clear message - never the raw SQL error
        // that the FK constraint manga_edition.entity_id would throw without the guard extended in step 5.
        assertThatThrownBy(() -> entityDeletionService.delete(entity.id()))
                .isInstanceOf(EntityDeletionNotAllowedException.class)
                .hasMessageContaining("1 édition");
    }

    @Test
    void search_matches_by_title_across_types_and_respects_type_and_tag_filters() {
        Entity deathNote = Entity.create(EntityTypeFixtures.MANGA.id(), "Death Note");
        Tag seinen = tagRepository.save(new Tag(UUID.randomUUID(), "seinen-" + UUID.randomUUID()));
        deathNote.addTag(seinen.id());
        entityRepository.save(deathNote);

        Entity hollowKnight = Entity.create(EntityTypeFixtures.VIDEO_GAME.id(), "Hollow Knight");
        entityRepository.save(hollowKnight);

        // Cross-type search by title, without type filter: must
        // return only the Entity whose title matches, whatever its type.
        assertThat(entityRepository.search("death", null, null))
                .extracting(Entity::id)
                .containsExactly(deathNote.id());

        // Empty search + type filter only: all the mangas.
        assertThat(entityRepository.search(null, EntityTypeFixtures.MANGA.id(), null))
                .extracting(Entity::id)
                .contains(deathNote.id())
                .doesNotContain(hollowKnight.id());

        // Filter by tag: only the tagged Entity must be returned.
        assertThat(entityRepository.search(null, null, seinen.id()))
                .extracting(Entity::id)
                .containsExactly(deathNote.id());

        // A title that matches nothing returns an empty list, not an error.
        assertThat(entityRepository.search("un titre qui n'existe vraiment pas", null, null)).isEmpty();
    }
}
