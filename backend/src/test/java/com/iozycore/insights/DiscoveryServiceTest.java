package com.iozycore.insights;

import com.iozycore.domain.catalog.Entity;
import com.iozycore.domain.catalog.EntityRepository;
import com.iozycore.domain.catalog.EntityType;
import com.iozycore.domain.catalog.EntityTypeFixtures;
import com.iozycore.domain.catalog.EntityTypeRepository;
import com.iozycore.domain.experience.Experience;
import com.iozycore.domain.experience.ExperienceRepository;
import com.iozycore.metadata.MetadataCandidate;
import com.iozycore.metadata.bgg.BggHotListFetcher;
import com.iozycore.metadata.bgg.BggThingFetcher;
import com.iozycore.metadata.igdb.IgdbSimilarGamesFetcher;
import com.iozycore.metadata.jikan.JikanMetadataProvider;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class DiscoveryServiceTest {

    @Test
    void suggests_other_works_by_the_same_mangaka_excluding_owned_titles() {
        InMemoryEntityRepository entityRepository = new InMemoryEntityRepository();
        InMemoryExperienceRepository experienceRepository = new InMemoryExperienceRepository();

        Entity deathNote = Entity.create(EntityTypeFixtures.MANGA.id(), "Death Note");
        deathNote.setAttribute("mangaka", "Ohba, Tsugumi");
        entityRepository.save(deathNote);
        experienceRepository.save(Experience.record_(deathNote.id(), "READ", LocalDate.now(), 9, null));

        StubJikanMetadataProvider jikan = new StubJikanMetadataProvider(List.of(
                new MetadataCandidate("JIKAN", "1", "Death Note", null, Map.of()), // déjà possédé - doit être exclu
                new MetadataCandidate("JIKAN", "2", "Bakuman", null, Map.of())     // nouveau - doit apparaître
        ));

        DiscoveryService service = new DiscoveryService(
                entityRepository, new InMemoryEntityTypeRepository(), experienceRepository, jikan,
                new BggThingFetcher(), new BggHotListFetcher(), new StubIgdbSimilarGamesFetcher(List.of()));

        List<DiscoveryCandidate> suggestions = service.discoverManga();

        assertThat(suggestions).extracting(DiscoveryCandidate::title).containsExactly("Bakuman");
        assertThat(suggestions.get(0).reason()).contains("Ohba, Tsugumi");
    }

    @Test
    void returns_an_empty_list_when_nothing_is_owned() {
        DiscoveryService service = new DiscoveryService(
                new InMemoryEntityRepository(), new InMemoryEntityTypeRepository(), new InMemoryExperienceRepository(),
                new StubJikanMetadataProvider(List.of()), new BggThingFetcher(), new BggHotListFetcher(),
                new StubIgdbSimilarGamesFetcher(List.of()));

        assertThat(service.discoverManga()).isEmpty();
    }

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

        DiscoveryService service = new DiscoveryService(
                entityRepository, new InMemoryEntityTypeRepository(), new InMemoryExperienceRepository(),
                new StubJikanMetadataProvider(List.of()), new BggThingFetcher(), new BggHotListFetcher(), igdb);

        List<DiscoveryCandidate> suggestions = service.discoverVideoGames();

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

    private static class StubJikanMetadataProvider extends JikanMetadataProvider {
        private final List<MetadataCandidate> results;

        StubJikanMetadataProvider(List<MetadataCandidate> results) {
            this.results = results;
        }

        @Override
        public List<MetadataCandidate> search(String query) {
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

    /** Seedé avec les 3 fixtures - suffisant pour discoverManga()/discoverBoardGames()/discoverVideoGames(). */
    private static class InMemoryEntityTypeRepository implements EntityTypeRepository {
        private final Map<UUID, EntityType> store = new HashMap<>(Map.of(
                EntityTypeFixtures.MANGA.id(), EntityTypeFixtures.MANGA,
                EntityTypeFixtures.BOARD_GAME.id(), EntityTypeFixtures.BOARD_GAME,
                EntityTypeFixtures.VIDEO_GAME.id(), EntityTypeFixtures.VIDEO_GAME));

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
            return List.copyOf(store.values());
        }
    }
}
