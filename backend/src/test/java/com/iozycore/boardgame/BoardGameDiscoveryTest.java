package com.iozycore.boardgame;

import com.iozycore.boardgame.bgg.BggCollectionItem;
import com.iozycore.boardgame.bgg.BggHotListFetcher;
import com.iozycore.boardgame.bgg.BggThingFetcher;
import com.iozycore.core.domain.catalog.Entity;
import com.iozycore.core.domain.catalog.EntityRepository;
import com.iozycore.core.domain.catalog.EntityTypeFixtures;
import com.iozycore.core.insights.Discovery;
import com.iozycore.core.insights.Discovery.EmptyReason;
import com.iozycore.core.insights.DiscoveryCandidate;
import com.iozycore.core.metadata.SourceUnavailableException;
import org.junit.jupiter.api.Test;

import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Board game discovery: the BGG hot games that share categories with the owned
 * ones, and what the panel is told when BGG is silent (batch 159).
 */
class BoardGameDiscoveryTest {

    private static final String AZUL_ID = "230802";
    private static final String CASCADIA_ID = "295947";
    private static final String DUNE_ID = "316554";

    @Test
    void suggests_hot_games_that_share_a_category_excluding_owned_titles() {
        StubBggThingFetcher things = new StubBggThingFetcher(Map.of(
                AZUL_ID, Set.of("Abstract Strategy", "Tile Placement"),
                CASCADIA_ID, Set.of("Tile Placement", "Animals"),
                DUNE_ID, Set.of("Science Fiction")));
        StubBggHotListFetcher hot = new StubBggHotListFetcher(List.of(
                new BggCollectionItem(AZUL_ID, "Azul", null),       // already owned - must be excluded
                new BggCollectionItem(CASCADIA_ID, "Cascadia", null),
                new BggCollectionItem(DUNE_ID, "Dune: Imperium", null)));

        Discovery result = new BoardGameDiscovery(repositoryWithAzul(), things, hot).discover(EntityTypeFixtures.BOARD_GAME);

        assertThat(result.candidates()).extracting(DiscoveryCandidate::title).containsExactly("Cascadia");
        assertThat(result.candidates().get(0).reason()).isEqualTo("En commun : Tile Placement");
        assertThat(result.sourceAnswered()).isTrue();
    }

    @Test
    void says_nothing_is_owned_without_asking_bgg() {
        StubBggHotListFetcher hot = new StubBggHotListFetcher(List.of());

        Discovery result = new BoardGameDiscovery(new InMemoryEntityRepository(), new StubBggThingFetcher(Map.of()), hot)
                .discover(EntityTypeFixtures.BOARD_GAME);

        assertThat(result.sourceAnswered()).isTrue();
        assertThat(result.emptyReason()).isEqualTo(EmptyReason.NOTHING_OWNED);
        assertThat(hot.calls).isZero();
    }

    @Test
    void says_no_game_comes_from_bgg_when_none_carries_a_bgg_id() {
        InMemoryEntityRepository entityRepository = new InMemoryEntityRepository();
        entityRepository.save(Entity.create(EntityTypeFixtures.BOARD_GAME.id(), "Typed by hand"));
        StubBggHotListFetcher hot = new StubBggHotListFetcher(List.of());

        Discovery result = new BoardGameDiscovery(entityRepository, new StubBggThingFetcher(Map.of()), hot)
                .discover(EntityTypeFixtures.BOARD_GAME);

        assertThat(result.emptyReason()).isEqualTo(EmptyReason.NOT_LINKED_TO_SOURCE);
        assertThat(hot.calls).isZero();
    }

    @Test
    void says_bgg_did_not_answer_when_the_hot_list_is_silent() {
        StubBggThingFetcher things = new StubBggThingFetcher(Map.of(AZUL_ID, Set.of("Tile Placement")));

        Discovery result = new BoardGameDiscovery(repositoryWithAzul(), things, new SilentBggHotListFetcher())
                .discover(EntityTypeFixtures.BOARD_GAME);

        assertThat(result.candidates()).isEmpty();
        assertThat(result.sourceAnswered()).isFalse();
        assertThat(result.emptyReason()).isNull();
    }

    @Test
    void says_bgg_did_not_answer_when_the_owned_games_categories_are_silent() {
        StubBggThingFetcher things = new StubBggThingFetcher(Map.of());
        things.silentIds.add(AZUL_ID);
        StubBggHotListFetcher hot = new StubBggHotListFetcher(List.of(new BggCollectionItem(CASCADIA_ID, "Cascadia", null)));

        Discovery result = new BoardGameDiscovery(repositoryWithAzul(), things, hot).discover(EntityTypeFixtures.BOARD_GAME);

        assertThat(result.candidates()).isEmpty();
        assertThat(result.sourceAnswered()).isFalse();
    }

    @Test
    void no_shared_category_is_an_answer_not_an_outage() {
        StubBggThingFetcher things = new StubBggThingFetcher(Map.of(
                AZUL_ID, Set.of("Tile Placement"),
                DUNE_ID, Set.of("Science Fiction")));
        StubBggHotListFetcher hot = new StubBggHotListFetcher(List.of(new BggCollectionItem(DUNE_ID, "Dune: Imperium", null)));

        Discovery result = new BoardGameDiscovery(repositoryWithAzul(), things, hot).discover(EntityTypeFixtures.BOARD_GAME);

        assertThat(result.candidates()).isEmpty();
        assertThat(result.sourceAnswered()).isTrue();
        assertThat(result.emptyReason()).isNull();
    }

    private static InMemoryEntityRepository repositoryWithAzul() {
        InMemoryEntityRepository entityRepository = new InMemoryEntityRepository();
        Entity azul = Entity.create(EntityTypeFixtures.BOARD_GAME.id(), "Azul");
        azul.setAttribute("bggId", AZUL_ID);
        entityRepository.save(azul);
        return entityRepository;
    }

    private static class StubBggThingFetcher extends BggThingFetcher {
        private final Map<String, Set<String>> categoriesById;
        final Set<String> silentIds = new HashSet<>();

        StubBggThingFetcher(Map<String, Set<String>> categoriesById) {
            this.categoriesById = categoriesById;
        }

        @Override
        public Set<String> fetchCategoriesAndMechanics(String bggId) {
            if (silentIds.contains(bggId)) {
                throw new SourceUnavailableException("BGG answered 503 for /thing?id=" + bggId);
            }
            return categoriesById.getOrDefault(bggId, Set.of());
        }
    }

    private static class StubBggHotListFetcher extends BggHotListFetcher {
        private final List<BggCollectionItem> hotGames;
        int calls;

        StubBggHotListFetcher(List<BggCollectionItem> hotGames) {
            this.hotGames = hotGames;
        }

        @Override
        public List<BggCollectionItem> fetchHotBoardGames() {
            calls++;
            return hotGames;
        }
    }

    private static class SilentBggHotListFetcher extends BggHotListFetcher {
        @Override
        public List<BggCollectionItem> fetchHotBoardGames() {
            throw new SourceUnavailableException("BGG answered 503 for /hot");
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
            return store.values().stream().filter(e -> e.entityTypeId().equals(entityTypeId)).toList();
        }

        @Override
        public List<Entity> search(String titleQuery, UUID entityTypeId, UUID tagId) {
            return List.of();
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
}
