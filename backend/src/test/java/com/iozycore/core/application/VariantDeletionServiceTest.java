package com.iozycore.core.application;

import com.iozycore.manga.domain.EditionTier;
import com.iozycore.core.domain.catalog.Entity;
import com.iozycore.core.domain.catalog.EntityRepository;
import com.iozycore.core.domain.catalog.EntityTypeFixtures;
import com.iozycore.manga.domain.MangaEdition;
import com.iozycore.manga.domain.MangaEditionRepository;
import com.iozycore.core.domain.catalog.Variant;
import com.iozycore.core.domain.experience.Experience;
import com.iozycore.core.domain.experience.ExperienceRepository;
import com.iozycore.core.domain.ownership.Ownership;
import com.iozycore.core.domain.ownership.OwnershipCondition;
import com.iozycore.core.domain.ownership.OwnershipRepository;
import com.iozycore.core.domain.shared.VariantDeletionNotAllowedException;
import com.iozycore.manga.deals.MarketPriceObservation;
import com.iozycore.manga.deals.MarketPriceObservationRepository;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import com.iozycore.manga.MangaEditionDeletionGuard;
import com.iozycore.manga.MangaOrphanEditionCleanup;

/**
 * Vérifie la garde de suppression d'un Tome (étape 4, modèle Série -> Édition -> Tome)
 * avec de faux repositories en mémoire - même patron que OwnershipDeletionServiceTest.
 */
class VariantDeletionServiceTest {

    private final InMemoryEntityRepository entityRepository = new InMemoryEntityRepository();
    private final InMemoryOwnershipRepository ownershipRepository = new InMemoryOwnershipRepository();
    private final InMemoryExperienceRepository experienceRepository = new InMemoryExperienceRepository();
    private final InMemoryMangaEditionRepository mangaEditionRepository = new InMemoryMangaEditionRepository();
    private final InMemoryMarketPriceObservationRepository marketPriceObservationRepository =
            new InMemoryMarketPriceObservationRepository();
    private final EntityDeletionService entityDeletionService =
            new EntityDeletionService(entityRepository, ownershipRepository, experienceRepository, List.of(new MangaEditionDeletionGuard(mangaEditionRepository)));
    private final VariantDeletionService service = new VariantDeletionService(entityRepository, ownershipRepository, experienceRepository, List.of(new MangaOrphanEditionCleanup(mangaEditionRepository, marketPriceObservationRepository)), entityDeletionService);

    @Test
    void a_variant_with_no_ownership_and_no_experience_is_deleted() {
        // Un second tome garde la Série non-vide, pour isoler ce test de la cascade
        // "0 tome -> suppression de la Série" (voir les tests dédiés plus bas).
        Entity entity = Entity.create(EntityTypeFixtures.MANGA.id(), "Death Note");
        Variant variant = entity.addVariant("Tome 1", Map.of("volumeNumber", 1));
        entity.addVariant("Tome 2", Map.of("volumeNumber", 2));
        entityRepository.save(entity);

        service.delete(entity.id(), variant.id());

        Entity reloaded = entityRepository.findById(entity.id()).orElseThrow();
        assertThat(reloaded.variants()).extracting(Variant::label).containsExactly("Tome 2");
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

    @Test
    void an_edition_with_a_recorded_market_observation_survives_losing_its_last_tome() {
        Entity entity = Entity.create(EntityTypeFixtures.MANGA.id(), "Sanctuary");
        Variant variant = entity.addVariant("Tome 1", Map.of("volumeNumber", 1));
        MangaEdition edition = mangaEditionRepository.save(MangaEdition.create(entity.id(), "Sanctuary",
                "Perfect Edition", EditionTier.PERFECT, "Glénat", 6, null, false, false, null));
        entity.linkVariantToEdition(variant.id(), edition.id());
        entityRepository.save(entity);
        marketPriceObservationRepository.save(MarketPriceObservation.record_(
                edition.id(), null, new BigDecimal("150"), null, null, LocalDate.now(), null));

        service.delete(entity.id(), variant.id()); // ne lève rien, le cascade s'arrête juste là

        assertThat(mangaEditionRepository.findById(edition.id())).isPresent(); // conservée
    }

    @Test
    void deleting_the_last_tome_of_an_edition_cascades_to_delete_the_edition_too() {
        Entity entity = Entity.create(EntityTypeFixtures.MANGA.id(), "Death Note");
        Variant variant = entity.addVariant("Tome 1", Map.of("volumeNumber", 1));
        MangaEdition edition = mangaEditionRepository.save(MangaEdition.create(entity.id(), "Death Note",
                "Perfect Edition", EditionTier.DELUXE, "Kana", 6, null, false, false, null));
        entity.linkVariantToEdition(variant.id(), edition.id());
        entityRepository.save(entity);

        service.delete(entity.id(), variant.id());

        assertThat(mangaEditionRepository.findById(edition.id())).isEmpty();
    }

    @Test
    void deleting_a_tome_keeps_its_edition_alive_while_a_sibling_tome_still_uses_it() {
        Entity entity = Entity.create(EntityTypeFixtures.MANGA.id(), "Death Note");
        Variant tome1 = entity.addVariant("Tome 1", Map.of("volumeNumber", 1));
        Variant tome2 = entity.addVariant("Tome 2", Map.of("volumeNumber", 2));
        MangaEdition edition = mangaEditionRepository.save(MangaEdition.create(entity.id(), "Death Note",
                "Perfect Edition", EditionTier.DELUXE, "Kana", 6, null, false, false, null));
        entity.linkVariantToEdition(tome1.id(), edition.id());
        entity.linkVariantToEdition(tome2.id(), edition.id());
        entityRepository.save(entity);

        service.delete(entity.id(), tome1.id());

        assertThat(mangaEditionRepository.findById(edition.id())).isPresent(); // tome2 l'utilise encore
    }

    @Test
    void deleting_the_last_tome_of_a_series_cascades_to_delete_the_series_too() {
        Entity entity = Entity.create(EntityTypeFixtures.MANGA.id(), "Death Note");
        Variant variant = entity.addVariant("Tome 1", Map.of("volumeNumber", 1));
        entityRepository.save(entity);

        service.delete(entity.id(), variant.id());

        assertThat(entityRepository.findById(entity.id())).isEmpty(); // plus aucun tome -> plus de série
    }

    @Test
    void deleting_the_last_tome_without_any_edition_still_cascades_the_series() {
        // La règle est bien "0 tome" et non "0 édition" - un Tome sans édition renseignée
        // (voir QuickAddService, edition optionnel) compte tout autant comme un vrai Tome
        // catalogué tant qu'il existe encore.
        Entity entity = Entity.create(EntityTypeFixtures.MANGA.id(), "Death Note");
        Variant variant = entity.addVariant("Tome 1", Map.of("volumeNumber", 1)); // pas d'édition
        entityRepository.save(entity);

        service.delete(entity.id(), variant.id());

        assertThat(entityRepository.findById(entity.id())).isEmpty();
    }

    @Test
    void a_series_kept_alive_by_a_generic_ownership_survives_losing_its_last_tome() {
        // Ownership sans Variant précis (ex: "One Piece" ajouté sans choisir de tome) -
        // le cascade "0 tome -> suppression de la Série" ne doit jamais l'ignorer
        // silencieusement : EntityDeletionService bloque, la Série survit.
        Entity entity = Entity.create(EntityTypeFixtures.MANGA.id(), "One Piece");
        Variant variant = entity.addVariant("Tome 1", Map.of("volumeNumber", 1));
        entityRepository.save(entity);
        ownershipRepository.save(Ownership.acquire(entity.id(), null, OwnershipCondition.NEW, LocalDate.now(), null));

        service.delete(entity.id(), variant.id());

        Entity reloaded = entityRepository.findById(entity.id()).orElseThrow(); // toujours là
        assertThat(reloaded.variants()).isEmpty(); // le tome, lui, a bien disparu
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

    /** Faux repository en mémoire pour MangaEdition, même patron que les autres ci-dessus. */
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

    /** Faux repository en mémoire pour MarketPriceObservation - juste assez pour vérifier
     * que le cascade Édition (étape 5) épargne une Édition qui porte des données réelles. */
    private static class InMemoryMarketPriceObservationRepository implements MarketPriceObservationRepository {
        private final List<MarketPriceObservation> store = new ArrayList<>();

        @Override
        public MarketPriceObservation save(MarketPriceObservation observation) {
            store.add(observation);
            return observation;
        }

        @Override
        public void deleteById(UUID id) {
            store.removeIf(o -> o.id().equals(id));
        }

        @Override
        public List<MarketPriceObservation> findAll() {
            return List.copyOf(store);
        }

        @Override
        public List<MarketPriceObservation> findByEditionId(UUID mangaEditionId) {
            return store.stream().filter(o -> o.mangaEditionId().equals(mangaEditionId)).toList();
        }

        @Override
        public int countByEditionIdAllOwners(UUID mangaEditionId) {
            // En mémoire, il n'y a qu'un seul propriétaire : les deux
            // questions se confondent.
            return findByEditionId(mangaEditionId).size();
        }
    }
}
