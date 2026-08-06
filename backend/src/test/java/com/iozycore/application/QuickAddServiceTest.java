package com.iozycore.application;

import com.iozycore.domain.catalog.Entity;
import com.iozycore.domain.catalog.EntityRepository;
import com.iozycore.domain.catalog.EntityTypeFixtures;
import com.iozycore.domain.ownership.Ownership;
import com.iozycore.domain.ownership.OwnershipCondition;
import com.iozycore.domain.ownership.OwnershipRepository;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Vérifie la déduplication de l'ajout rapide (UC1, étape 6) avec de faux
 * repositories en mémoire - pas besoin de Spring ni de PostgreSQL pour
 * tester cette règle applicative.
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
        QuickAddService service = new QuickAddService(entityRepository, ownershipRepository, event -> {
        });

        QuickAddService.QuickAddResult first = service.addNewEntityWithOwnership(
                EntityTypeFixtures.MANGA.id(), "Death Note - Tome 1", OwnershipCondition.NEW);
        // Casse différente volontairement, pour vérifier le match insensible à la casse.
        QuickAddService.QuickAddResult second = service.addNewEntityWithOwnership(
                EntityTypeFixtures.MANGA.id(), "death note - tome 1", OwnershipCondition.USED);

        assertThat(second.matchedExistingEntity()).isTrue();
        assertThat(second.entityId()).isEqualTo(first.entityId());
        assertThat(entityRepository.count()).isEqualTo(1); // aucun doublon dans le Catalog
        assertThat(ownershipRepository.findByEntityId(first.entityId())).hasSize(2); // 2 exemplaires distincts
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
        QuickAddService service = new QuickAddService(repo, new InMemoryOwnershipRepository(), event -> {
        });

        service.addNewEntityWithOwnership(EntityTypeFixtures.MANGA.id(), "Death Note - Tome 1", OwnershipCondition.NEW,
                Map.of("mangaka", "Saisie manuelle"));
        service.addNewEntityWithOwnership(EntityTypeFixtures.MANGA.id(), "Death Note - Tome 1", OwnershipCondition.NEW,
                Map.of("mangaka", "Ohba, Tsugumi", "publisher", "Kana"));

        Entity entity = repo.findByTypeAndTitle(EntityTypeFixtures.MANGA.id(), "Death Note - Tome 1").orElseThrow();
        assertThat(entity.attributes()).containsEntry("mangaka", "Saisie manuelle"); // pas écrasé
        assertThat(entity.attributes()).containsEntry("publisher", "Kana"); // complété
    }

    private QuickAddService newService() {
        return new QuickAddService(new InMemoryEntityRepository(), new InMemoryOwnershipRepository(), event -> {
        });
    }

    /** Faux repository en mémoire, suffisant pour tester la logique applicative sans Spring/PostgreSQL. */
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
            return store.values().stream()
                    .filter(e -> titleQuery == null || titleQuery.isBlank()
                            || e.title().toLowerCase().contains(titleQuery.toLowerCase()))
                    .filter(e -> entityTypeId == null || e.entityTypeId().equals(entityTypeId))
                    .filter(e -> tagId == null || e.tagIds().contains(tagId))
                    .collect(java.util.stream.Collectors.toList());
        }

        @Override
        public boolean existsByType(UUID entityTypeId) {
            return store.values().stream().anyMatch(e -> e.entityTypeId().equals(entityTypeId));
        }

        @Override
        public void deleteById(UUID id) {
            store.remove(id);
        }

        int count() {
            return store.size();
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
            List<Ownership> result = new ArrayList<>();
            for (Ownership ownership : store.values()) {
                if (ownership.entityId().equals(entityId)) {
                    result.add(ownership);
                }
            }
            return result;
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
}
