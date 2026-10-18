package com.iozycore.core.application;

import com.iozycore.core.domain.catalog.Entity;
import com.iozycore.core.domain.catalog.EntityTypeFixtures;
import com.iozycore.core.domain.catalog.Relationship;
import com.iozycore.core.domain.catalog.Tag;
import com.iozycore.core.domain.catalog.Variant;
import com.iozycore.core.domain.experience.Experience;
import com.iozycore.core.domain.ownership.Ownership;
import com.iozycore.core.domain.ownership.OwnershipCondition;
import com.iozycore.core.domain.ownership.OwnershipStatus;
import com.iozycore.core.metadata.MetadataDetailsService;
import com.iozycore.core.testing.InMemoryEntityRepository;
import com.iozycore.core.testing.InMemoryEntityTypeRepository;
import com.iozycore.core.testing.InMemoryExperienceRepository;
import com.iozycore.core.testing.InMemoryOwnershipRepository;
import com.iozycore.core.testing.InMemoryRelationshipRepository;
import com.iozycore.core.testing.InMemoryTagRepository;
import com.iozycore.core.testing.InMemoryWishlistEntryRepository;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * The small use cases of the catalog that used to live in their controllers:
 * tags, relationships, experiences, copies, and the work itself.
 */
class CatalogUseCasesTest {

    private final UUID manga = EntityTypeFixtures.MANGA.id();
    private final InMemoryEntityRepository entities = new InMemoryEntityRepository();
    private final InMemoryEntityTypeRepository types = new InMemoryEntityTypeRepository(EntityTypeFixtures.MANGA);

    @Nested
    class Tags {

        private final InMemoryTagRepository tags = new InMemoryTagRepository();
        private final TagService service = new TagService(tags, entities);

        @Test
        void creating_an_existing_label_returns_the_same_tag() {
            Tag first = service.create("seinen");

            assertThat(service.create("seinen").id()).isEqualTo(first.id());
            assertThat(tags.findAll()).hasSize(1);
        }

        @Test
        void attaching_an_unknown_tag_or_to_an_unknown_work_is_not_found() {
            Entity work = entities.save(Entity.create(manga, "Berserk"));
            Tag tag = service.create("seinen");

            assertThatThrownBy(() -> service.attach(work.id(), UUID.randomUUID())).isInstanceOf(NotFoundException.class);
            assertThatThrownBy(() -> service.attach(UUID.randomUUID(), tag.id())).isInstanceOf(NotFoundException.class);

            service.attach(work.id(), tag.id());
            assertThat(entities.findById(work.id()).orElseThrow().tagIds()).containsExactly(tag.id());
        }

        @Test
        void renaming_refuses_a_blank_label_and_a_label_taken_by_another_tag() {
            Tag seinen = service.create("seinen");
            service.create("shonen");

            assertThatThrownBy(() -> service.rename(seinen.id(), "  ")).isInstanceOf(IllegalArgumentException.class);
            assertThatThrownBy(() -> service.rename(seinen.id(), "shonen")).isInstanceOf(IllegalStateException.class);
            assertThat(service.rename(seinen.id(), " seinen ").label()).isEqualTo("seinen");
        }

        @Test
        void deleting_an_unknown_tag_is_not_found() {
            assertThatThrownBy(() -> service.delete(UUID.randomUUID())).isInstanceOf(NotFoundException.class);
        }
    }

    @Nested
    class Relationships {

        private final RelationshipService service = new RelationshipService(new InMemoryRelationshipRepository(), entities);

        @Test
        void both_ends_must_exist() {
            Entity source = entities.save(Entity.create(manga, "Berserk"));

            assertThatThrownBy(() -> service.create(source.id(), UUID.randomUUID(), "ADAPTED_INTO"))
                    .isInstanceOf(IllegalArgumentException.class);
        }

        @Test
        void changing_the_type_keeps_the_ends() {
            Entity source = entities.save(Entity.create(manga, "Berserk"));
            Entity target = entities.save(Entity.create(manga, "Berserk (anime)"));
            Relationship created = service.create(source.id(), target.id(), "SPIN_OFF");

            Relationship changed = service.changeType(created.id(), "ADAPTED_INTO");

            assertThat(changed.sourceEntityId()).isEqualTo(source.id());
            assertThat(changed.targetEntityId()).isEqualTo(target.id());
            assertThat(service.from(source.id())).extracting(Relationship::relationshipType).containsExactly("ADAPTED_INTO");
            assertThatThrownBy(() -> service.changeType(UUID.randomUUID(), "X")).isInstanceOf(NotFoundException.class);
        }
    }

    @Nested
    class Experiences {

        private final InMemoryExperienceRepository experiences = new InMemoryExperienceRepository();
        private final ExperienceService service = new ExperienceService(experiences, entities, types);

        @Test
        void refuses_a_type_the_universe_does_not_allow_and_a_volume_of_another_work() {
            Entity work = entities.save(Entity.create(manga, "Berserk"));

            assertThatThrownBy(() -> service.record(work.id(), null, "PLAYED", LocalDate.now(), null, null))
                    .isInstanceOf(IllegalArgumentException.class);
            assertThatThrownBy(() -> service.record(work.id(), UUID.randomUUID(), "READ", LocalDate.now(), null, null))
                    .isInstanceOf(IllegalArgumentException.class);
            assertThatThrownBy(() -> service.record(UUID.randomUUID(), null, "READ", LocalDate.now(), null, null))
                    .isInstanceOf(IllegalArgumentException.class);
        }

        @Test
        void an_out_of_range_rating_changes_nothing() {
            Entity work = entities.save(Entity.create(manga, "Berserk"));
            Experience recorded = service.record(work.id(), null, "READ", LocalDate.now(), 7, null);

            assertThatThrownBy(() -> service.update(recorded.id(), 42, "!")).isInstanceOf(IllegalArgumentException.class);
            assertThat(experiences.findById(recorded.id()).orElseThrow().rating()).contains(7);
            assertThatThrownBy(() -> service.update(UUID.randomUUID(), 5, null)).isInstanceOf(NotFoundException.class);
        }
    }

    @Nested
    class Copies {

        private final InMemoryOwnershipRepository ownerships = new InMemoryOwnershipRepository();
        private final OwnershipService service = new OwnershipService(ownerships);

        @Test
        void sold_then_restored_and_an_active_copy_cannot_be_restored() {
            Ownership copy = ownerships.save(Ownership.acquire(UUID.randomUUID(), null, OwnershipCondition.NEW,
                    LocalDate.now(), null));

            assertThat(service.markSold(copy.id()).status()).isEqualTo(OwnershipStatus.SOLD);
            assertThat(service.restore(copy.id()).status()).isEqualTo(OwnershipStatus.OWNED);
            assertThatThrownBy(() -> service.restore(copy.id())).isInstanceOf(IllegalStateException.class);
            assertThatThrownBy(() -> service.markLost(UUID.randomUUID())).isInstanceOf(NotFoundException.class);
        }
    }

    @Nested
    class Works {

        private final InMemoryOwnershipRepository ownerships = new InMemoryOwnershipRepository();
        private final QuickAddService quickAddService = new QuickAddService(entities, ownerships,
                new CatalogEntityResolver(entities), new TomeResolver(entities, List.of(), List.of()),
                new InMemoryWishlistEntryRepository(), event -> {
        });
        private final EntityService service = new EntityService(entities, new EntityTypeLookup(types),
                quickAddService, new MetadataDetailsService(List.of(), types),
                List.of(url -> !url.contains("placeholder")));

        @Test
        void quick_add_refuses_an_unknown_type() {
            assertThatThrownBy(() -> service.quickAdd(new EntityService.QuickAdd(UUID.randomUUID(), "Berserk",
                    OwnershipCondition.NEW, null, null, null, null, null, null)))
                    .isInstanceOf(IllegalArgumentException.class);
        }

        @Test
        void a_source_never_overwrites_a_key_typed_by_hand() {
            Entity work = entities.save(Entity.create(manga, "Berserk"));
            service.mergeAttributes(work.id(), Map.of("publisher", "Glénat"), EntityService.AttributeOrigin.MANUAL);

            Entity merged = service.mergeAttributes(work.id(), Map.of("publisher", "Autre", "mangaka", "Miura"),
                    EntityService.AttributeOrigin.SOURCE);

            assertThat(merged.attributes()).containsEntry("publisher", "Glénat").containsEntry("mangaka", "Miura");
        }

        @Test
        void an_unknown_origin_is_a_bad_request() {
            assertThatThrownBy(() -> EntityService.AttributeOrigin.parse("robot"))
                    .isInstanceOf(IllegalArgumentException.class);
        }

        @Test
        void an_unusable_cover_is_left_out_of_a_volume() {
            Entity work = Entity.create(manga, "Berserk");
            Variant volume = work.addVariant("Tome 1", Map.of());
            entities.save(work);

            Entity merged = service.mergeVariantAttributes(work.id(), volume.id(),
                    Map.of("coverImageUrl", "https://x/placeholder.png", "isbn", "123"));

            Map<String, Object> attributes = merged.variants().get(0).attributes();
            assertThat(attributes).containsEntry("isbn", "123").doesNotContainKey("coverImageUrl");
            assertThatThrownBy(() -> service.mergeVariantAttributes(work.id(), UUID.randomUUID(), Map.of()))
                    .isInstanceOf(NotFoundException.class);
        }

        @Test
        void an_unknown_work_is_not_found() {
            assertThatThrownBy(() -> service.get(UUID.randomUUID())).isInstanceOf(NotFoundException.class);
            assertThatThrownBy(() -> service.rename(UUID.randomUUID(), "x")).isInstanceOf(NotFoundException.class);
        }
    }
}
