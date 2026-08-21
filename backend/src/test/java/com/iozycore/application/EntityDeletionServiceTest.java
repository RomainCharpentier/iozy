package com.iozycore.application;

import com.iozycore.domain.catalog.EditionTier;
import com.iozycore.domain.catalog.Entity;
import com.iozycore.domain.catalog.EntityRepository;
import com.iozycore.domain.catalog.EntityTypeFixtures;
import com.iozycore.domain.catalog.MangaEdition;
import com.iozycore.domain.catalog.MangaEditionRepository;
import com.iozycore.domain.experience.Experience;
import com.iozycore.domain.experience.ExperienceRepository;
import com.iozycore.domain.ownership.Ownership;
import com.iozycore.domain.ownership.OwnershipCondition;
import com.iozycore.domain.ownership.OwnershipRepository;
import com.iozycore.domain.shared.EntityDeletionNotAllowedException;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Vérifie la garde de suppression d'une Entity (Série), y compris l'extension
 * étape 5 (modèle Série -> Édition -> Tome) : bloquée aussi tant qu'une Édition
 * catalogue la référence encore.
 */
class EntityDeletionServiceTest {

    private final InMemoryEntityRepository entityRepository = new InMemoryEntityRepository();
    private final InMemoryOwnershipRepository ownershipRepository = new InMemoryOwnershipRepository();
    private final InMemoryExperienceRepository experienceRepository = new InMemoryExperienceRepository();
    private final InMemoryMangaEditionRepository mangaEditionRepository = new InMemoryMangaEditionRepository();
    private final EntityDeletionService service =
            new EntityDeletionService(entityRepository, ownershipRepository, experienceRepository, mangaEditionRepository);

    @Test
    void an_entity_with_no_reference_at_all_is_deleted() {
        Entity entity = Entity.create(EntityTypeFixtures.MANGA.id(), "Death Note");
        entityRepository.save(entity);

        service.delete(entity.id());

        assertThat(entityRepository.findById(entity.id())).isEmpty();
    }

    @Test
    void an_entity_referenced_by_an_ownership_is_never_deleted() {
        Entity entity = Entity.create(EntityTypeFixtures.MANGA.id(), "Death Note");
        entityRepository.save(entity);
        ownershipRepository.save(Ownership.acquire(entity.id(), null, OwnershipCondition.NEW, LocalDate.now(), null));

        assertThatThrownBy(() -> service.delete(entity.id()))
                .isInstanceOf(EntityDeletionNotAllowedException.class)
                .hasMessageContaining("1 ownership");
        assertThat(entityRepository.findById(entity.id())).isPresent();
    }

    @Test
    void an_entity_referenced_by_an_experience_is_never_deleted() {
        Entity entity = Entity.create(EntityTypeFixtures.MANGA.id(), "Death Note");
        entityRepository.save(entity);
        experienceRepository.save(Experience.record_(entity.id(), null, "READ", LocalDate.now(), 8, null));

        assertThatThrownBy(() -> service.delete(entity.id()))
                .isInstanceOf(EntityDeletionNotAllowedException.class)
                .hasMessageContaining("1 expérience");
    }

    @Test
    void an_entity_still_referenced_by_a_catalog_edition_is_never_deleted() {
        // Étape 5 : sans cette garde, la contrainte FK manga_edition.entity_id
        // rejetterait la suppression avec une erreur SQL brute plutôt qu'un message clair.
        Entity entity = Entity.create(EntityTypeFixtures.MANGA.id(), "Death Note");
        entityRepository.save(entity);
        mangaEditionRepository.save(MangaEdition.create(entity.id(), "Death Note", "Perfect Edition",
                EditionTier.DELUXE, "Kana", 6, null, false, false, null));

        assertThatThrownBy(() -> service.delete(entity.id()))
                .isInstanceOf(EntityDeletionNotAllowedException.class)
                .hasMessageContaining("1 édition");
        assertThat(entityRepository.findById(entity.id())).isPresent();
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
            return store.values().stream().filter(e -> e.entityTypeId().equals(entityTypeId)).toList();
        }

        @Override
        public List<Entity> search(String titleQuery, UUID entityTypeId, UUID tagId) {
            return List.copyOf(store.values());
        }

        @Override
        public boolean existsByType(UUID entityTypeId) {
            return store.values().stream().anyMatch(e -> e.entityTypeId().equals(entityTypeId));
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

        @Override
        public void deleteById(UUID id) {
            store.remove(id);
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
        public List<Experience> findAll() {
            return new ArrayList<>(store.values());
        }

        @Override
        public void deleteById(UUID id) {
            store.remove(id);
        }

        @Override
        public boolean existsByEntityId(UUID entityId) {
            return !findByEntityId(entityId).isEmpty();
        }
    }

    private static class InMemoryMangaEditionRepository implements MangaEditionRepository {
        private final Map<UUID, MangaEdition> store = new HashMap<>();

        @Override
        public MangaEdition save(MangaEdition edition) {
            store.put(edition.id(), edition);
            return edition;
        }

        @Override
        public Optional<MangaEdition> findById(UUID id) {
            return Optional.ofNullable(store.get(id));
        }

        @Override
        public List<MangaEdition> findAll() {
            return List.copyOf(store.values());
        }

        @Override
        public Optional<MangaEdition> findBySeriesAndEdition(String seriesTitle, String editionName) {
            return store.values().stream()
                    .filter(e -> e.seriesTitle().equalsIgnoreCase(seriesTitle) && e.editionName().equalsIgnoreCase(editionName))
                    .findFirst();
        }

        @Override
        public List<MangaEdition> findBySeriesTitle(String seriesTitle) {
            return store.values().stream().filter(e -> e.seriesTitle().equalsIgnoreCase(seriesTitle)).toList();
        }

        @Override
        public List<MangaEdition> findByEntityId(UUID entityId) {
            return store.values().stream().filter(e -> entityId.equals(e.entityId())).toList();
        }

        @Override
        public Optional<MangaEdition> findByEntityIdAndEditionName(UUID entityId, String editionName) {
            return store.values().stream()
                    .filter(e -> entityId.equals(e.entityId()) && e.editionName().equalsIgnoreCase(editionName))
                    .findFirst();
        }

        @Override
        public void deleteById(UUID id) {
            store.remove(id);
        }
    }
}
