package com.iozycore.manga;

import com.iozycore.core.domain.catalog.Entity;
import com.iozycore.core.domain.catalog.EntityRepository;
import com.iozycore.core.domain.catalog.EntityType;
import com.iozycore.core.domain.catalog.EntityTypeFixtures;
import com.iozycore.core.domain.experience.Experience;
import com.iozycore.core.domain.experience.ExperienceRepository;
import com.iozycore.core.metadata.MetadataCandidate;
import com.iozycore.manga.metadata.jikan.JikanMetadataProvider;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import com.iozycore.core.insights.DiscoveryCandidate;

/** La découverte des mangas - tests extraits de DiscoveryServiceTest au Lot 133. */
class MangaDiscoveryTest {

    @Test
    void suggests_other_works_by_the_same_mangaka_excluding_owned_titles() {
        InMemoryEntityRepository entityRepository = new InMemoryEntityRepository();
        InMemoryExperienceRepository experienceRepository = new InMemoryExperienceRepository();

        Entity deathNote = Entity.create(EntityTypeFixtures.MANGA.id(), "Death Note");
        deathNote.setAttribute("mangaka", "Ohba, Tsugumi");
        entityRepository.save(deathNote);
        experienceRepository.save(Experience.record_(deathNote.id(), null, "READ", LocalDate.now(), 9, null));

        StubJikanMetadataProvider jikan = new StubJikanMetadataProvider(List.of(
                new MetadataCandidate("JIKAN", "1", "Death Note", null, Map.of()), // déjà possédé - doit être exclu
                new MetadataCandidate("JIKAN", "2", "Bakuman", null, Map.of())     // nouveau - doit apparaître
        ));

        MangaDiscovery service = new MangaDiscovery(entityRepository, experienceRepository, List.of(jikan));

        List<DiscoveryCandidate> suggestions = service.discover(EntityTypeFixtures.MANGA);

        assertThat(suggestions).extracting(DiscoveryCandidate::title).containsExactly("Bakuman");
        assertThat(suggestions.get(0).reason()).contains("Ohba, Tsugumi");
    }

    @Test
    void returns_an_empty_list_when_nothing_is_owned() {
        MangaDiscovery service = new MangaDiscovery(new InMemoryEntityRepository(), new InMemoryExperienceRepository(), List.of(new StubJikanMetadataProvider(List.of())));

        assertThat(service.discover(EntityTypeFixtures.MANGA)).isEmpty();
    }

    // ------------------------------------------ Ce que la mesure a volume a trouve (lot 141)

    @Test
    void lit_les_notes_en_une_seule_fois_et_non_une_fois_par_oeuvre() {
        // 300 series = 300 requetes de notes par ouverture de Decouvrir.
        InMemoryEntityRepository entityRepository = new InMemoryEntityRepository();
        InMemoryExperienceRepository experienceRepository = new InMemoryExperienceRepository();
        for (int i = 0; i < 50; i++) {
            Entity serie = Entity.create(EntityTypeFixtures.MANGA.id(), "Série " + i);
            serie.setAttribute("mangaka", "Auteur " + (i % 5));
            entityRepository.save(serie);
            experienceRepository.save(Experience.record_(serie.id(), null, "READ", LocalDate.now(), 5 + (i % 5), null));
        }
        MangaDiscovery service = new MangaDiscovery(entityRepository, experienceRepository,
                List.of(new StubJikanMetadataProvider(List.of(new MetadataCandidate("JIKAN", "9", "Autre", null, Map.of())))));

        service.discover(EntityTypeFixtures.MANGA);

        assertThat(experienceRepository.lecturesParOeuvre).isZero();
        assertThat(experienceRepository.lecturesGlobales).isEqualTo(1);
    }

    @Test
    void retient_les_suggestions_au_lieu_de_retourner_chez_les_fournisseurs_a_chaque_ouverture() {
        InMemoryEntityRepository entityRepository = new InMemoryEntityRepository();
        InMemoryExperienceRepository experienceRepository = new InMemoryExperienceRepository();
        Entity berserk = Entity.create(EntityTypeFixtures.MANGA.id(), "Berserk");
        berserk.setAttribute("mangaka", "Miura, Kentarou");
        entityRepository.save(berserk);
        experienceRepository.save(Experience.record_(berserk.id(), null, "READ", LocalDate.now(), 10, null));
        StubJikanMetadataProvider jikan = new StubJikanMetadataProvider(
                List.of(new MetadataCandidate("JIKAN", "3", "Gigantomakhia", null, Map.of())));
        MangaDiscovery service = new MangaDiscovery(entityRepository, experienceRepository, List.of(jikan));

        List<DiscoveryCandidate> premiere = service.discover(EntityTypeFixtures.MANGA);
        List<DiscoveryCandidate> seconde = service.discover(EntityTypeFixtures.MANGA);

        assertThat(seconde).isEqualTo(premiere);
        assertThat(jikan.appels).isEqualTo(1);
    }

    @Test
    void ne_retient_pas_un_resultat_vide_pour_qu_un_fournisseur_muet_soit_reessaye() {
        InMemoryEntityRepository entityRepository = new InMemoryEntityRepository();
        InMemoryExperienceRepository experienceRepository = new InMemoryExperienceRepository();
        Entity berserk = Entity.create(EntityTypeFixtures.MANGA.id(), "Berserk");
        berserk.setAttribute("mangaka", "Miura, Kentarou");
        entityRepository.save(berserk);
        experienceRepository.save(Experience.record_(berserk.id(), null, "READ", LocalDate.now(), 10, null));
        StubJikanMetadataProvider muet = new StubJikanMetadataProvider(List.of());
        MangaDiscovery service = new MangaDiscovery(entityRepository, experienceRepository, List.of(muet));

        service.discover(EntityTypeFixtures.MANGA);
        service.discover(EntityTypeFixtures.MANGA);

        assertThat(muet.appels).isEqualTo(2);
    }

    private static class StubJikanMetadataProvider extends JikanMetadataProvider {
        private final List<MetadataCandidate> results;
        int appels;

        StubJikanMetadataProvider(List<MetadataCandidate> results) {
            this.results = results;
        }

        @Override
        public List<MetadataCandidate> search(String query) {
            appels++;
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

    private static class InMemoryExperienceRepository implements ExperienceRepository {
        private final Map<UUID, Experience> store = new HashMap<>();
        int lecturesParOeuvre;
        int lecturesGlobales;

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
            lecturesParOeuvre++;
            return store.values().stream().filter(e -> e.entityId().equals(entityId)).toList();
        }

        @Override
        public void deleteById(UUID id) {
            store.remove(id);
        }

        @Override
        public boolean existsByEntityId(UUID entityId) {
            return !findByEntityId(entityId).isEmpty();
        }

        @Override
        public List<Experience> findAll() {
            lecturesGlobales++;
            return List.copyOf(store.values());
        }
    }
}
