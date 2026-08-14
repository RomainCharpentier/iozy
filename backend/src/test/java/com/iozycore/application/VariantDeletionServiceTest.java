package com.iozycore.application;

import com.iozycore.domain.catalog.Entity;
import com.iozycore.domain.catalog.EntityRepository;
import com.iozycore.domain.catalog.EntityTypeFixtures;
import com.iozycore.domain.catalog.Variant;
import com.iozycore.domain.experience.Experience;
import com.iozycore.domain.experience.ExperienceRepository;
import com.iozycore.domain.ownership.Ownership;
import com.iozycore.domain.ownership.OwnershipCondition;
import com.iozycore.domain.ownership.OwnershipRepository;
import com.iozycore.domain.shared.VariantDeletionNotAllowedException;
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
 * Vérifie la garde de suppression d'un Tome (étape 4, modèle Série -> Édition -> Tome)
 * avec de faux repositories en mémoire - même patron que OwnershipDeletionServiceTest.
 */
class VariantDeletionServiceTest {

    private final InMemoryEntityRepository entityRepository = new InMemoryEntityRepository();
    private final InMemoryOwnershipRepository ownershipRepository = new InMemoryOwnershipRepository();
    private final InMemoryExperienceRepository experienceRepository = new InMemoryExperienceRepository();
    private final VariantDeletionService service =
            new VariantDeletionService(entityRepository, ownershipRepository, experienceRepository);

    @Test
    void a_variant_with_no_ownership_and_no_experience_is_deleted() {
        Entity entity = Entity.create(EntityTypeFixtures.MANGA.id(), "Death Note");
        Variant variant = entity.addVariant("Tome 1", Map.of("volumeNumber", 1));
        entityRepository.save(entity);

        service.delete(entity.id(), variant.id());

        assertThat(entityRepository.findById(entity.id()).orElseThrow().variants()).isEmpty();
    }

    @Test
    void a_variant_referenced_by_an_active_ownership_is_never_deleted() {
        Entity entity = Entity.create(EntityTypeFixtures.MANGA.id(), "Death Note");
        Variant variant = entity.addVariant("Tome 1", Map.of("volumeNumber", 1));
        entityRepository.save(entity);
        ownershipRepository.save(Ownership.acquire(entity.id(), variant.id(), OwnershipCondition.NEW, LocalDate.now(), null));

        assertThatThrownBy(() -> service.delete(entity.id(), variant.id()))
                .isInstanceOf(VariantDeletionNotAllowedException.class)
                .hasMessageContaining("1 ownership");

        // Jamais de suppression partielle : la garde bloque AVANT tout appel à entity.removeVariant.
        assertThat(entityRepository.findById(entity.id()).orElseThrow().variants()).hasSize(1);
    }

    @Test
    void a_variant_referenced_by_a_sold_ownership_is_still_never_deleted() {
        // Contrairement à EntityDeletionService (qui bloque déjà sur n'importe quelle
        // Ownership), cette garde ne distingue pas non plus active/vendue - l'historique
        // de possession de CE tome précis ne doit jamais se retrouver à pointer dans le vide.
        Entity entity = Entity.create(EntityTypeFixtures.MANGA.id(), "Death Note");
        Variant variant = entity.addVariant("Tome 1", Map.of("volumeNumber", 1));
        entityRepository.save(entity);
        Ownership sold = Ownership.acquire(entity.id(), variant.id(), OwnershipCondition.NEW, LocalDate.now(), null);
        sold.markSold();
        ownershipRepository.save(sold);

        assertThatThrownBy(() -> service.delete(entity.id(), variant.id()))
                .isInstanceOf(VariantDeletionNotAllowedException.class);
    }

    @Test
    void a_variant_referenced_by_an_experience_is_never_deleted() {
        Entity entity = Entity.create(EntityTypeFixtures.MANGA.id(), "Death Note");
        Variant variant = entity.addVariant("Tome 1", Map.of("volumeNumber", 1));
        entityRepository.save(entity);
        experienceRepository.save(Experience.record_(entity.id(), variant.id(), "READ", LocalDate.now(), 8, null));

        assertThatThrownBy(() -> service.delete(entity.id(), variant.id()))
                .isInstanceOf(VariantDeletionNotAllowedException.class)
                .hasMessageContaining("1 expérience");
    }

    @Test
    void deleting_one_variant_never_affects_a_sibling_variant_even_if_it_is_owned() {
        Entity entity = Entity.create(EntityTypeFixtures.MANGA.id(), "Death Note");
        Variant tome1 = entity.addVariant("Tome 1", Map.of("volumeNumber", 1));
        Variant tome2 = entity.addVariant("Tome 2", Map.of("volumeNumber", 2));
        entityRepository.save(entity);
        ownershipRepository.save(Ownership.acquire(entity.id(), tome2.id(), OwnershipCondition.NEW, LocalDate.now(), null));

        service.delete(entity.id(), tome1.id()); // tome1 n'a aucune référence ; tome2 en a, mais n'est pas concerné ici

        assertThat(entityRepository.findById(entity.id()).orElseThrow().variants())
                .extracting(Variant::id).containsExactly(tome2.id());
    }

    @Test
    void deleting_a_variant_of_an_unknown_entity_fails_loudly() {
        assertThatThrownBy(() -> service.delete(UUID.randomUUID(), UUID.randomUUID()))
                .isInstanceOf(IllegalArgumentException.class);
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
        public boolean existsByEntityId(UUID entityId) {
            return !findByEntityId(entityId).isEmpty();
        }
    }
}
