package com.iozycore.insights;

import com.iozycore.domain.catalog.Entity;
import com.iozycore.domain.catalog.EntityRepository;
import com.iozycore.domain.catalog.EntityType;
import com.iozycore.domain.catalog.Tag;
import com.iozycore.domain.catalog.TagRepository;
import com.iozycore.domain.experience.Experience;
import com.iozycore.domain.experience.ExperienceRepository;
import com.iozycore.domain.ownership.Ownership;
import com.iozycore.domain.ownership.OwnershipCondition;
import com.iozycore.domain.ownership.OwnershipRepository;
import com.iozycore.domain.wishlist.WishlistEntry;
import com.iozycore.domain.wishlist.WishlistEntryRepository;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class StatsServiceTest {

    @Test
    void computes_entity_ownership_and_experience_counts_per_type() {
        InMemoryEntityRepository entityRepository = new InMemoryEntityRepository();
        InMemoryOwnershipRepository ownershipRepository = new InMemoryOwnershipRepository();
        InMemoryExperienceRepository experienceRepository = new InMemoryExperienceRepository();
        InMemoryWishlistEntryRepository wishlistEntryRepository = new InMemoryWishlistEntryRepository();
        InMemoryTagRepository tagRepository = new InMemoryTagRepository();

        Entity deathNote = Entity.create(EntityType.MANGA.id(), "Death Note");
        Tag seinen = new Tag(UUID.randomUUID(), "seinen");
        deathNote.addTag(seinen.id());
        tagRepository.save(seinen);
        entityRepository.save(deathNote);

        Entity hollowKnight = Entity.create(EntityType.VIDEO_GAME.id(), "Hollow Knight");
        entityRepository.save(hollowKnight);

        ownershipRepository.save(Ownership.acquire(deathNote.id(), null, OwnershipCondition.NEW, LocalDate.now(), null));
        Ownership soldOwnership = Ownership.acquire(hollowKnight.id(), null, OwnershipCondition.USED, LocalDate.now(), null);
        soldOwnership.markSold();
        ownershipRepository.save(soldOwnership);

        experienceRepository.save(Experience.record_(deathNote.id(), "READ", LocalDate.now(), 9, null));
        experienceRepository.save(Experience.record_(deathNote.id(), "READ", LocalDate.now(), 7, null));

        wishlistEntryRepository.save(WishlistEntry.add(UUID.randomUUID(), LocalDate.now()));

        StatsService statsService = new StatsService(
                entityRepository, ownershipRepository, experienceRepository, wishlistEntryRepository, tagRepository);

        StatsSummary summary = statsService.computeSummary();

        assertThat(summary.totalEntities()).isEqualTo(2);
        assertThat(summary.totalActiveOwnerships()).isEqualTo(1); // Hollow Knight vendue, ne compte plus
        assertThat(summary.wishlistCount()).isEqualTo(1);
        assertThat(summary.experiencesThisYear()).isEqualTo(2);

        StatsSummary.TypeStats mangaStats = summary.byType().stream()
                .filter(s -> s.entityTypeCode().equals("MANGA")).findFirst().orElseThrow();
        assertThat(mangaStats.entityCount()).isEqualTo(1);
        assertThat(mangaStats.experienceCount()).isEqualTo(2);
        assertThat(mangaStats.averageRating()).isEqualTo(8.0); // (9+7)/2

        StatsSummary.TypeStats videoGameStats = summary.byType().stream()
                .filter(s -> s.entityTypeCode().equals("VIDEO_GAME")).findFirst().orElseThrow();
        assertThat(videoGameStats.activeOwnershipCount()).isEqualTo(0);
        assertThat(videoGameStats.averageRating()).isNull(); // aucune expérience notée

        assertThat(summary.topTags()).hasSize(1);
        assertThat(summary.topTags().get(0).label()).isEqualTo("seinen");
        assertThat(summary.topTags().get(0).count()).isEqualTo(1);
    }

    private static class InMemoryEntityRepository implements EntityRepository {
        private final Map<UUID, Entity> store = new HashMap<>();

        @Override
        public Entity save(Entity entity) {
            store.put(entity.id(), entity);
            return entity;
        }

        @Override
        public Optional<Entity> findById(UUID id) {
            return Optional.ofNullable(store.get(id));
        }

        @Override
        public Optional<Entity> findByTypeAndTitle(UUID entityTypeId, String title) {
            return store.values().stream()
                    .filter(e -> e.entityTypeId().equals(entityTypeId) && e.title().equalsIgnoreCase(title))
                    .findFirst();
        }

        @Override
        public List<Entity> findAllByType(UUID entityTypeId) {
            List<Entity> result = new ArrayList<>();
            for (Entity entity : store.values()) {
                if (entity.entityTypeId().equals(entityTypeId)) {
                    result.add(entity);
                }
            }
            return result;
        }

        @Override
        public List<Entity> search(String titleQuery, UUID entityTypeId, UUID tagId) {
            return List.of(); // non exercé par ce test
        }

        @Override
        public void deleteById(UUID id) {
            store.remove(id);
        }
    }

    private static class InMemoryOwnershipRepository implements OwnershipRepository {
        private final Map<UUID, Ownership> store = new HashMap<>();

        @Override
        public Ownership save(Ownership ownership) {
            store.put(ownership.id(), ownership);
            return ownership;
        }

        @Override
        public Optional<Ownership> findById(UUID id) {
            return Optional.ofNullable(store.get(id));
        }

        @Override
        public List<Ownership> findByEntityId(UUID entityId) {
            return store.values().stream().filter(o -> o.entityId().equals(entityId)).toList();
        }

        @Override
        public boolean existsByEntityId(UUID entityId) {
            return !findByEntityId(entityId).isEmpty();
        }

        @Override
        public List<Ownership> findAll() {
            return new ArrayList<>(store.values());
        }
    }

    private static class InMemoryExperienceRepository implements ExperienceRepository {
        private final Map<UUID, Experience> store = new HashMap<>();

        @Override
        public Experience save(Experience experience) {
            store.put(experience.id(), experience);
            return experience;
        }

        @Override
        public Optional<Experience> findById(UUID id) {
            return Optional.ofNullable(store.get(id));
        }

        @Override
        public List<Experience> findByEntityId(UUID entityId) {
            return store.values().stream().filter(e -> e.entityId().equals(entityId)).toList();
        }

        @Override
        public boolean existsByEntityId(UUID entityId) {
            return !findByEntityId(entityId).isEmpty();
        }

        @Override
        public List<Experience> findAll() {
            return new ArrayList<>(store.values());
        }
    }

    private static class InMemoryWishlistEntryRepository implements WishlistEntryRepository {
        private final Map<UUID, WishlistEntry> store = new HashMap<>();

        @Override
        public WishlistEntry save(WishlistEntry entry) {
            store.put(entry.id(), entry);
            return entry;
        }

        @Override
        public Optional<WishlistEntry> findByEntityId(UUID entityId) {
            return store.values().stream().filter(e -> e.entityId().equals(entityId)).findFirst();
        }

        @Override
        public List<WishlistEntry> findAll() {
            return new ArrayList<>(store.values());
        }

        @Override
        public void deleteById(UUID id) {
            store.remove(id);
        }
    }

    private static class InMemoryTagRepository implements TagRepository {
        private final Map<UUID, Tag> store = new HashMap<>();

        @Override
        public Tag save(Tag tag) {
            store.put(tag.id(), tag);
            return tag;
        }

        @Override
        public Optional<Tag> findById(UUID id) {
            return Optional.ofNullable(store.get(id));
        }

        @Override
        public Optional<Tag> findByLabel(String label) {
            return store.values().stream().filter(t -> t.label().equals(label)).findFirst();
        }

        @Override
        public List<Tag> findAll() {
            return new ArrayList<>(store.values());
        }
    }
}
