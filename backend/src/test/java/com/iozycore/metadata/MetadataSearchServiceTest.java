package com.iozycore.metadata;

import com.iozycore.domain.catalog.Entity;
import com.iozycore.domain.catalog.EntityRepository;
import com.iozycore.domain.catalog.EntityType;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class MetadataSearchServiceTest {

    private static final EntityType MANGA = new EntityType(UUID.randomUUID(), "MANGA", "Manga", Set.of(), Set.of());

    @Test
    void excludes_candidates_whose_title_is_already_in_the_collection() {
        Entity alreadyOwned = Entity.create(MANGA.id(), "Naruto");
        FakeEntityRepository repository = new FakeEntityRepository(List.of(alreadyOwned));
        FakeMetadataProvider provider = new FakeMetadataProvider(List.of(
                candidate("Naruto"),          // déjà possédé (comparaison insensible à la casse)
                candidate("Boruto")));         // pas encore possédé

        MetadataSearchService service = new MetadataSearchService(List.of(provider), List.of(), repository, List.of());

        List<MetadataCandidate> results = service.search(MANGA, "naruto");

        assertThat(results).extracting(MetadataCandidate::title).containsExactly("Boruto");
    }

    @Test
    void barcode_lookup_is_not_filtered_by_the_collection_so_a_second_copy_can_still_be_attached() {
        Entity alreadyOwned = Entity.create(MANGA.id(), "Naruto");
        FakeEntityRepository repository = new FakeEntityRepository(List.of(alreadyOwned));
        FakeBarcodeProvider barcodeProvider = new FakeBarcodeProvider(candidate("Naruto"));

        MetadataSearchService service =
                new MetadataSearchService(List.of(), List.of(barcodeProvider), repository, List.of());

        Optional<MetadataCandidate> result = service.lookupByBarcode(MANGA, "9780000000000");

        assertThat(result).isPresent();
        assertThat(result.get().title()).isEqualTo("Naruto");
    }

    @Test
    void does_not_call_the_provider_again_for_a_repeated_identical_search() {
        FakeEntityRepository repository = new FakeEntityRepository(List.of());
        FakeMetadataProvider provider = new FakeMetadataProvider(List.of(candidate("Boruto")));
        MetadataSearchService service = new MetadataSearchService(List.of(provider), List.of(), repository, List.of());

        service.search(MANGA, "naruto");
        service.search(MANGA, "NARUTO"); // même requête à la casse près - doit rester un cache hit

        assertThat(provider.callCount).isEqualTo(1);
    }

    @Test
    void a_newly_added_entity_is_excluded_even_though_the_underlying_search_is_served_from_cache() {
        FakeEntityRepository repository = new FakeEntityRepository(List.of());
        FakeMetadataProvider provider = new FakeMetadataProvider(List.of(candidate("Naruto"), candidate("Boruto")));
        MetadataSearchService service = new MetadataSearchService(List.of(provider), List.of(), repository, List.of());

        List<MetadataCandidate> beforeOwning = service.search(MANGA, "naruto");
        repository.entities.add(Entity.create(MANGA.id(), "Naruto")); // ajouté entre les deux appels
        List<MetadataCandidate> afterOwning = service.search(MANGA, "naruto");

        assertThat(beforeOwning).extracting(MetadataCandidate::title).containsExactlyInAnyOrder("Naruto", "Boruto");
        assertThat(afterOwning).extracting(MetadataCandidate::title).containsExactly("Boruto");
        assertThat(provider.callCount).isEqualTo(1); // le second appel reste un cache hit côté provider
    }

    @Test
    void does_not_call_the_barcode_provider_again_for_a_repeated_identical_barcode() {
        FakeEntityRepository repository = new FakeEntityRepository(List.of());
        FakeBarcodeProvider barcodeProvider = new FakeBarcodeProvider(candidate("Naruto"));
        MetadataSearchService service =
                new MetadataSearchService(List.of(), List.of(barcodeProvider), repository, List.of());

        service.lookupByBarcode(MANGA, "9780000000000");
        service.lookupByBarcode(MANGA, "9780000000000");

        assertThat(barcodeProvider.callCount).isEqualTo(1);
    }

    @Test
    void does_not_call_the_french_title_provider_again_for_a_repeated_identical_query() {
        FakeEntityRepository repository = new FakeEntityRepository(List.of());
        FakeFrenchTitleProvider frenchTitleProvider = new FakeFrenchTitleProvider(Optional.of("L'Attaque des Titans"));
        MetadataSearchService service =
                new MetadataSearchService(List.of(), List.of(), repository, List.of(frenchTitleProvider));

        Optional<String> first = service.findFrenchTitle(MANGA, "Shingeki no Kyojin", "Hajime Isayama");
        // même requête à la casse près - doit rester un cache hit
        Optional<String> second = service.findFrenchTitle(MANGA, "shingeki no kyojin", "hajime isayama");

        assertThat(first).contains("L'Attaque des Titans");
        assertThat(second).contains("L'Attaque des Titans");
        assertThat(frenchTitleProvider.callCount).isEqualTo(1);
    }

    @Test
    void tries_the_next_french_title_provider_when_the_first_finds_nothing() {
        FakeEntityRepository repository = new FakeEntityRepository(List.of());
        FakeFrenchTitleProvider firstProvider = new FakeFrenchTitleProvider(Optional.empty());
        FakeFrenchTitleProvider secondProvider = new FakeFrenchTitleProvider(Optional.of("L'Attaque des Titans"));
        MetadataSearchService service = new MetadataSearchService(
                List.of(), List.of(), repository, List.of(firstProvider, secondProvider));

        Optional<String> result = service.findFrenchTitle(MANGA, "Shingeki no Kyojin", "Hajime Isayama");

        assertThat(result).contains("L'Attaque des Titans");
        assertThat(firstProvider.callCount).isEqualTo(1);
        assertThat(secondProvider.callCount).isEqualTo(1);
    }

    @Test
    void does_not_cache_a_failed_barcode_lookup_so_a_later_retry_can_still_succeed() {
        FakeEntityRepository repository = new FakeEntityRepository(List.of());
        StatefulBarcodeProvider provider = new StatefulBarcodeProvider(candidate("Naruto"));
        MetadataSearchService service = new MetadataSearchService(List.of(), List.of(provider), repository, List.of());

        Optional<MetadataCandidate> firstAttempt = service.lookupByBarcode(MANGA, "9780000000000"); // panne réseau simulée
        Optional<MetadataCandidate> secondAttempt = service.lookupByBarcode(MANGA, "9780000000000"); // ré-essai qui réussit

        assertThat(firstAttempt).isEmpty();
        assertThat(secondAttempt).isPresent();
        assertThat(provider.callCount).isEqualTo(2); // pas de cache hit après l'échec
    }

    @Test
    void does_not_cache_a_failed_french_title_lookup_so_a_later_retry_can_still_succeed() {
        FakeEntityRepository repository = new FakeEntityRepository(List.of());
        StatefulFrenchTitleProvider provider = new StatefulFrenchTitleProvider("L'Attaque des Titans");
        MetadataSearchService service =
                new MetadataSearchService(List.of(), List.of(), repository, List.of(provider));

        Optional<String> firstAttempt = service.findFrenchTitle(MANGA, "Shingeki no Kyojin", "Hajime Isayama");
        Optional<String> secondAttempt = service.findFrenchTitle(MANGA, "Shingeki no Kyojin", "Hajime Isayama");

        assertThat(firstAttempt).isEmpty();
        assertThat(secondAttempt).contains("L'Attaque des Titans");
        assertThat(provider.callCount).isEqualTo(2); // pas de cache hit après l'échec
    }

    @Test
    void does_not_call_the_french_title_provider_for_an_unsupported_entity_type() {
        EntityType videoGame = new EntityType(UUID.randomUUID(), "VIDEO_GAME", "Jeu vidéo", Set.of(), Set.of());
        FakeEntityRepository repository = new FakeEntityRepository(List.of());
        FakeFrenchTitleProvider frenchTitleProvider = new FakeFrenchTitleProvider(Optional.of("Ne devrait jamais sortir"));
        MetadataSearchService service =
                new MetadataSearchService(List.of(), List.of(), repository, List.of(frenchTitleProvider));

        Optional<String> result = service.findFrenchTitle(videoGame, "Zelda", null);

        assertThat(result).isEmpty();
        assertThat(frenchTitleProvider.callCount).isEqualTo(0);
    }

    private static MetadataCandidate candidate(String title) {
        return new MetadataCandidate("FAKE", title, title, null, Map.of());
    }

    /** entities est volontairement mutable (copie défensive en constructeur compact) -
     * certains tests simulent un ajout survenant entre deux recherches. */
    private record FakeEntityRepository(List<Entity> entities) implements EntityRepository {
        FakeEntityRepository {
            entities = new ArrayList<>(entities);
        }

        @Override
        public Entity save(Entity entity) {
            throw new UnsupportedOperationException();
        }

        @Override
        public Optional<Entity> findById(UUID id) {
            throw new UnsupportedOperationException();
        }

        @Override
        public Optional<Entity> findByTypeAndTitle(UUID entityTypeId, String title) {
            throw new UnsupportedOperationException();
        }

        @Override
        public List<Entity> findAllByType(UUID entityTypeId) {
            return entities;
        }

        @Override
        public boolean existsByType(UUID entityTypeId) {
            throw new UnsupportedOperationException();
        }

        @Override
        public List<Entity> search(String titleQuery, UUID entityTypeId, UUID tagId) {
            throw new UnsupportedOperationException();
        }

        @Override
        public void deleteById(UUID id) {
            throw new UnsupportedOperationException();
        }
    }

    /** callCount n'est pas un composant de record exprès : il doit rester
     * mutable pour que les tests de cache puissent vérifier combien de fois
     * le "provider" a réellement été appelé (donc pas servi par le cache). */
    private static final class FakeMetadataProvider implements MetadataProvider {
        private final List<MetadataCandidate> results;
        int callCount = 0;

        FakeMetadataProvider(List<MetadataCandidate> results) {
            this.results = results;
        }

        @Override
        public boolean supports(EntityType entityType) {
            return true;
        }

        @Override
        public List<MetadataCandidate> search(String query) {
            callCount++;
            return results;
        }
    }

    private static final class FakeBarcodeProvider implements BarcodeMetadataProvider {
        private final MetadataCandidate result;
        int callCount = 0;

        FakeBarcodeProvider(MetadataCandidate result) {
            this.result = result;
        }

        @Override
        public boolean supports(EntityType entityType) {
            return true;
        }

        @Override
        public Optional<MetadataCandidate> lookup(String barcode) {
            callCount++;
            return Optional.of(result);
        }
    }

    private static final class FakeFrenchTitleProvider implements FrenchTitleProvider {
        private final Optional<String> result;
        int callCount = 0;

        FakeFrenchTitleProvider(Optional<String> result) {
            this.result = result;
        }

        @Override
        public boolean supports(EntityType entityType) {
            return "MANGA".equals(entityType.code());
        }

        @Override
        public Optional<String> findFrenchTitle(String query, String author) {
            callCount++;
            return result;
        }
    }

    /** Simule une panne réseau transitoire (empty) au premier appel, puis un
     * vrai résultat ensuite - vérifie qu'un échec n'est jamais mis en cache. */
    private static final class StatefulBarcodeProvider implements BarcodeMetadataProvider {
        private final MetadataCandidate result;
        int callCount = 0;

        StatefulBarcodeProvider(MetadataCandidate result) {
            this.result = result;
        }

        @Override
        public boolean supports(EntityType entityType) {
            return true;
        }

        @Override
        public Optional<MetadataCandidate> lookup(String barcode) {
            callCount++;
            return callCount == 1 ? Optional.empty() : Optional.of(result);
        }
    }

    /** Idem pour la recherche de titre français. */
    private static final class StatefulFrenchTitleProvider implements FrenchTitleProvider {
        private final String result;
        int callCount = 0;

        StatefulFrenchTitleProvider(String result) {
            this.result = result;
        }

        @Override
        public boolean supports(EntityType entityType) {
            return "MANGA".equals(entityType.code());
        }

        @Override
        public Optional<String> findFrenchTitle(String query, String author) {
            callCount++;
            return callCount == 1 ? Optional.empty() : Optional.of(result);
        }
    }
}
