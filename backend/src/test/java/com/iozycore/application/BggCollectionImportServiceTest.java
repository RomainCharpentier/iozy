package com.iozycore.application;

import com.iozycore.domain.catalog.Entity;
import com.iozycore.domain.catalog.EntityRepository;
import com.iozycore.domain.catalog.EntityType;
import com.iozycore.domain.catalog.EntityTypeFixtures;
import java.util.LinkedHashMap;
import com.iozycore.domain.wishlist.WishlistEntryRepository;
import com.iozycore.domain.wishlist.WishlistEntry;
import com.iozycore.domain.catalog.EntityTypeRepository;
import com.iozycore.domain.catalog.MangaEdition;
import com.iozycore.domain.catalog.MangaEditionRepository;
import com.iozycore.domain.ownership.Ownership;
import com.iozycore.domain.ownership.OwnershipRepository;
import com.iozycore.metadata.boardgame.BggCollectionFetcher;
import com.iozycore.metadata.boardgame.BggCollectionItem;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Vérifie l'orchestration de l'import BGG - le fetcher est stubbé (pas
 * d'appel réseau réel dans les tests), les repositories sont de simples
 * fakes en mémoire, comme pour QuickAddServiceTest.
 */
class BggCollectionImportServiceTest {

    @Test
    void imports_every_owned_game_and_counts_created_vs_matched() {
        StubBggCollectionFetcher fetcher = new StubBggCollectionFetcher(List.of(
                new BggCollectionItem("13", "Catan", "1995"),
                new BggCollectionItem("822", "Carcassonne", "2000")
        ));
        InMemoryEntityRepository entityRepository = new InMemoryEntityRepository();
        QuickAddService quickAddService = new QuickAddService(entityRepository, new InMemoryOwnershipRepository(),
                new CatalogEntityResolver(entityRepository),
                new TomeResolver(entityRepository, new InMemoryMangaEditionRepository()), new InMemoryWishlistEntryRepository(), event -> {
        });
        BggCollectionImportService importService =
                new BggCollectionImportService(fetcher, quickAddService, new InMemoryEntityTypeRepository());

        BggCollectionImportService.ImportResult result = importService.importOwnedGames("someuser");

        assertThat(result.totalFound()).isEqualTo(2);
        assertThat(result.created()).isEqualTo(2);
        assertThat(result.matchedExisting()).isEqualTo(0);
        assertThat(result.failed()).isEqualTo(0);
        assertThat(entityRepository.count()).isEqualTo(2);
    }

    @Test
    void re_importing_the_same_collection_matches_existing_entities_instead_of_duplicating() {
        StubBggCollectionFetcher fetcher = new StubBggCollectionFetcher(List.of(
                new BggCollectionItem("13", "Catan", "1995")
        ));
        InMemoryEntityRepository entityRepository = new InMemoryEntityRepository();
        QuickAddService quickAddService = new QuickAddService(entityRepository, new InMemoryOwnershipRepository(),
                new CatalogEntityResolver(entityRepository),
                new TomeResolver(entityRepository, new InMemoryMangaEditionRepository()), new InMemoryWishlistEntryRepository(), event -> {
        });
        BggCollectionImportService importService =
                new BggCollectionImportService(fetcher, quickAddService, new InMemoryEntityTypeRepository());

        importService.importOwnedGames("someuser");
        BggCollectionImportService.ImportResult second = importService.importOwnedGames("someuser");

        assertThat(second.matchedExisting()).isEqualTo(1);
        assertThat(second.created()).isEqualTo(0);
        assertThat(entityRepository.count()).isEqualTo(1); // toujours un seul Catan dans le Catalog
    }

    private static class StubBggCollectionFetcher extends BggCollectionFetcher {
        private final List<BggCollectionItem> items;

        StubBggCollectionFetcher(List<BggCollectionItem> items) {
            this.items = items;
        }

        @Override
        public List<BggCollectionItem> fetchOwnedGames(String username) {
            return items;
        }
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

    /** Seedé avec la fixture BOARD_GAME - le seul type que l'import BGG résout (par code). */
    private static class InMemoryEntityTypeRepository implements EntityTypeRepository {
        private final Map<UUID, EntityType> store = new HashMap<>(
                Map.of(EntityTypeFixtures.BOARD_GAME.id(), EntityTypeFixtures.BOARD_GAME));

        @Override
        public EntityType save(EntityType entityType) {
            store.put(entityType.id(), entityType);
            return entityType;
        }

        @Override
        public Optional<EntityType> findById(UUID id) {
            return Optional.ofNullable(store.get(id));
        }

        @Override
        public Optional<EntityType> findByCode(String code) {
            return store.values().stream().filter(t -> t.code().equals(code)).findFirst();
        }

        @Override
        public List<EntityType> findAll() {
            return List.copyOf(store.values());
        }

        @Override
        public void deleteById(UUID id) {
            store.remove(id);
        }
    }

    /** Faux repository en mémoire pour MangaEdition - jamais réellement exercé ici (les jeux de
     * société n'ont ni volumeNumber ni edition), requis seulement pour construire QuickAddService. */
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
            return store.values().stream()
                    .filter(e -> e.seriesTitle().equalsIgnoreCase(seriesTitle))
                    .collect(java.util.stream.Collectors.toList());
        }

        @Override
        public List<MangaEdition> findByEntityId(UUID entityId) {
            return store.values().stream()
                    .filter(e -> entityId.equals(e.entityId()))
                    .collect(java.util.stream.Collectors.toList());
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

        @Override
        public void deleteById(UUID id) {
            store.remove(id);
        }
    }

    /** Double local, comme les autres dépôts de ce fichier : QuickAddService
     *  referme l'envie d'une œuvre qu'on vient d'acquérir (voir
     *  retirerDesEnvies), il lui faut donc un dépôt d'envies. */
    private static class InMemoryWishlistEntryRepository implements WishlistEntryRepository {
        private final Map<UUID, WishlistEntry> parId = new LinkedHashMap<>();

        @Override
        public WishlistEntry save(WishlistEntry entry) {
            parId.put(entry.id(), entry);
            return entry;
        }

        @Override
        public Optional<WishlistEntry> findByEntityId(UUID entityId) {
            return parId.values().stream().filter(e -> e.entityId().equals(entityId)).findFirst();
        }

        @Override
        public List<WishlistEntry> findAll() {
            return List.copyOf(parId.values());
        }

        @Override
        public Optional<WishlistEntry> findByVariantId(UUID variantId) {
            return parId.values().stream()
                    .filter(e -> e.variantId().map(variantId::equals).orElse(false))
                    .findFirst();
        }

        @Override
        public List<WishlistEntry> findAllByEntityId(UUID entityId) {
            return parId.values().stream().filter(e -> e.entityId().equals(entityId)).toList();
        }

        @Override
        public void deleteById(UUID id) {
            parId.remove(id);
        }
    }
}
