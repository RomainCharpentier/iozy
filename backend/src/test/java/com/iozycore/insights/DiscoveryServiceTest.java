package com.iozycore.insights;

import com.iozycore.domain.catalog.Entity;
import com.iozycore.domain.catalog.EntityRepository;
import com.iozycore.domain.catalog.EntityType;
import com.iozycore.domain.experience.Experience;
import com.iozycore.domain.experience.ExperienceRepository;
import com.iozycore.metadata.MetadataCandidate;
import com.iozycore.metadata.bgg.BggHotListFetcher;
import com.iozycore.metadata.bgg.BggThingFetcher;
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

        Entity deathNote = Entity.create(EntityType.MANGA.id(), "Death Note");
        deathNote.setAttribute("mangaka", "Ohba, Tsugumi");
        entityRepository.save(deathNote);
        experienceRepository.save(Experience.record_(deathNote.id(), "READ", LocalDate.now(), 9, null));

        StubJikanMetadataProvider jikan = new StubJikanMetadataProvider(List.of(
                new MetadataCandidate("JIKAN", "1", "Death Note", null, Map.of()), // déjà possédé - doit être exclu
                new MetadataCandidate("JIKAN", "2", "Bakuman", null, Map.of())     // nouveau - doit apparaître
        ));

        DiscoveryService service = new DiscoveryService(
                entityRepository, experienceRepository, jikan, new BggThingFetcher(), new BggHotListFetcher());

        List<DiscoveryCandidate> suggestions = service.discoverManga();

        assertThat(suggestions).extracting(DiscoveryCandidate::title).containsExactly("Bakuman");
        assertThat(suggestions.get(0).reason()).contains("Ohba, Tsugumi");
    }

    @Test
    void returns_an_empty_list_when_nothing_is_owned() {
        DiscoveryService service = new DiscoveryService(
                new InMemoryEntityRepository(), new InMemoryExperienceRepository(),
                new StubJikanMetadataProvider(List.of()), new BggThingFetcher(), new BggHotListFetcher());

        assertThat(service.discoverManga()).isEmpty();
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
