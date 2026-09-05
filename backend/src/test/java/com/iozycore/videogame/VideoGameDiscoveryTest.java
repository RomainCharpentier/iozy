package com.iozycore.videogame;

import com.iozycore.domain.catalog.Entity;
import com.iozycore.domain.catalog.EntityRepository;
import com.iozycore.domain.catalog.EntityTypeFixtures;
import com.iozycore.insights.DiscoveryCandidate;
import com.iozycore.metadata.MetadataCandidate;
import com.iozycore.videogame.igdb.IgdbSimilarGamesFetcher;
import org.junit.jupiter.api.Test;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/** La découverte des jeux vidéo - test extrait de DiscoveryServiceTest au Lot 133. */
class VideoGameDiscoveryTest {

    @Test
    void suggests_similar_video_games_excluding_owned_titles() {
        InMemoryEntityRepository entityRepository = new InMemoryEntityRepository();

        Entity hollowKnight = Entity.create(EntityTypeFixtures.VIDEO_GAME.id(), "Hollow Knight");
        hollowKnight.setAttribute("igdbId", "8123");
        entityRepository.save(hollowKnight);

        StubIgdbSimilarGamesFetcher igdb = new StubIgdbSimilarGamesFetcher(List.of(
                new MetadataCandidate("IGDB", "8123", "Hollow Knight", null, Map.of()), // déjà possédé - doit être exclu
                new MetadataCandidate("IGDB", "9001", "Tunic", null, Map.of())          // nouveau - doit apparaître
        ));

        VideoGameDiscovery discovery = new VideoGameDiscovery(entityRepository, igdb);

        List<DiscoveryCandidate> suggestions = discovery.discover(EntityTypeFixtures.VIDEO_GAME);

        assertThat(suggestions).extracting(DiscoveryCandidate::title).containsExactly("Tunic");
        assertThat(suggestions.get(0).source()).isEqualTo("IGDB");
    }

    private static class StubIgdbSimilarGamesFetcher extends IgdbSimilarGamesFetcher {
        private final List<MetadataCandidate> results;

        StubIgdbSimilarGamesFetcher(List<MetadataCandidate> results) {
            super(null);
            this.results = results;
        }

        @Override
        public List<MetadataCandidate> fetchSimilarGames(String igdbId) {
            return results;
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
