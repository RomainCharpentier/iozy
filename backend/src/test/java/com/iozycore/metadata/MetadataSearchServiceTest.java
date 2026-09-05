package com.iozycore.metadata;

import com.iozycore.domain.catalog.Entity;
import com.iozycore.domain.catalog.EntityRepository;
import com.iozycore.domain.catalog.EntityType;
import com.iozycore.metadata.catalog.CatalogSearchService;
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

        MetadataSearchService service = new MetadataSearchService(List.of(provider), List.of(), new CatalogSearchService(repository));

        List<MetadataCandidate> results = service.search(MANGA, "naruto");

        assertThat(results).extracting(MetadataCandidate::title).containsExactly("Boruto");
    }

    @Test
    void barcode_lookup_is_not_filtered_by_the_collection_so_a_second_copy_can_still_be_attached() {
        Entity alreadyOwned = Entity.create(MANGA.id(), "Naruto");
        FakeEntityRepository repository = new FakeEntityRepository(List.of(alreadyOwned));
        FakeBarcodeProvider barcodeProvider = new FakeBarcodeProvider(candidate("Naruto"));

        MetadataSearchService service =
                new MetadataSearchService(List.of(), List.of(barcodeProvider), new CatalogSearchService(repository));

        Optional<MetadataCandidate> result = service.lookupByBarcode(MANGA, "9780000000000");

        assertThat(result).isPresent();
        assertThat(result.get().title()).isEqualTo("Naruto");
    }

    @Test
    void does_not_call_the_provider_again_for_a_repeated_identical_search() {
        FakeEntityRepository repository = new FakeEntityRepository(List.of());
        FakeMetadataProvider provider = new FakeMetadataProvider(List.of(candidate("Boruto")));
        MetadataSearchService service = new MetadataSearchService(List.of(provider), List.of(), new CatalogSearchService(repository));

        service.search(MANGA, "naruto");
        service.search(MANGA, "NARUTO"); // même requête à la casse près - doit rester un cache hit

        assertThat(provider.callCount).isEqualTo(1);
    }

    @Test
    void a_newly_added_entity_is_excluded_even_though_the_underlying_search_is_served_from_cache() {
        FakeEntityRepository repository = new FakeEntityRepository(List.of());
        FakeMetadataProvider provider = new FakeMetadataProvider(List.of(candidate("Naruto"), candidate("Boruto")));
        MetadataSearchService service = new MetadataSearchService(List.of(provider), List.of(), new CatalogSearchService(repository));

        List<MetadataCandidate> beforeOwning = service.search(MANGA, "naruto");
        repository.entities.add(Entity.create(MANGA.id(), "Naruto")); // ajouté entre les deux appels
        List<MetadataCandidate> afterOwning = service.search(MANGA, "naruto");

        assertThat(beforeOwning).extracting(MetadataCandidate::title).containsExactlyInAnyOrder("Naruto", "Boruto");
        assertThat(afterOwning).extracting(MetadataCandidate::title).containsExactly("Boruto");
        assertThat(provider.callCount).isEqualTo(1); // le second appel reste un cache hit côté provider
    }

    @Test
    void keeps_an_already_owned_title_when_the_caller_asks_for_it() {
        // Le filtre sert l'écran d'AJOUT. Recharger les informations d'une fiche
        // pose la question inverse - « que sait la source sur CETTE œuvre ? » -
        // et le filtre y garantissait zéro correspondance par construction :
        // sur Naruto, la recherche rendait huit dérivés et jamais la série.
        FakeEntityRepository repository = new FakeEntityRepository(List.of(Entity.create(MANGA.id(), "Naruto")));
        FakeMetadataProvider provider = new FakeMetadataProvider(List.of(candidate("Naruto"), candidate("Boruto")));
        MetadataSearchService service = new MetadataSearchService(List.of(provider), List.of(), new CatalogSearchService(repository));

        assertThat(service.search(MANGA, "naruto")).extracting(MetadataCandidate::title).containsExactly("Boruto");
        assertThat(service.search(MANGA, "naruto", true)).extracting(MetadataCandidate::title)
                .containsExactlyInAnyOrder("Naruto", "Boruto");
    }

    @Test
    void deduplicates_candidates_with_the_same_title_across_providers_keeping_the_first_providers_result() {
        // Cas réel observé (voir historique) : "Naruto", inchangé en
        // français, ressort à la fois de Jikan/MyAnimeList et de
        // GoogleBooksTitleSearchProvider - deux entrées identiques dans la
        // liste sans intérêt pour l'utilisateur.
        FakeMetadataProvider richProvider = new FakeMetadataProvider(List.of(candidate("Naruto")));
        FakeMetadataProvider poorProvider = new FakeMetadataProvider(
                List.of(new MetadataCandidate("GOOGLE_BOOKS", "gb1", "naruto", null, Map.of())));
        MetadataSearchService service = new MetadataSearchService(List.of(richProvider, poorProvider), List.of(), new CatalogSearchService(new FakeEntityRepository(List.of())));

        List<MetadataCandidate> results = service.search(MANGA, "naruto");

        assertThat(results).hasSize(1); // pas deux entrées "Naruto"
        assertThat(results.get(0).source()).isEqualTo("FAKE"); // le premier provider de la liste gagne
    }

    @Test
    void does_not_call_the_barcode_provider_again_for_a_repeated_identical_barcode() {
        FakeEntityRepository repository = new FakeEntityRepository(List.of());
        FakeBarcodeProvider barcodeProvider = new FakeBarcodeProvider(candidate("Naruto"));
        MetadataSearchService service =
                new MetadataSearchService(List.of(), List.of(barcodeProvider), new CatalogSearchService(repository));

        service.lookupByBarcode(MANGA, "9780000000000");
        service.lookupByBarcode(MANGA, "9780000000000");

        assertThat(barcodeProvider.callCount).isEqualTo(1);
    }

    @Test
    void does_not_cache_a_failed_barcode_lookup_so_a_later_retry_can_still_succeed() {
        FakeEntityRepository repository = new FakeEntityRepository(List.of());
        StatefulBarcodeProvider provider = new StatefulBarcodeProvider(candidate("Naruto"));
        MetadataSearchService service = new MetadataSearchService(List.of(), List.of(provider), new CatalogSearchService(repository));

        Optional<MetadataCandidate> firstAttempt = service.lookupByBarcode(MANGA, "9780000000000"); // panne réseau simulée
        Optional<MetadataCandidate> secondAttempt = service.lookupByBarcode(MANGA, "9780000000000"); // ré-essai qui réussit

        assertThat(firstAttempt).isEmpty();
        assertThat(secondAttempt).isPresent();
        assertThat(provider.callCount).isEqualTo(2); // pas de cache hit après l'échec
    }

    @Test
    void caches_a_barcode_the_databases_answered_they_do_not_know() {
        // Depuis que les photos d'un lot livrent une douzaine d'EAN d'un coup -
        // et qu'une identification prend de 1,4 a 5,5 s - reinterroger a chaque
        // analyse un code dont on SAIT qu'il est introuvable coute cher pour
        // rien.
        FakeEntityRepository repository = new FakeEntityRepository(List.of());
        CountingAbsentBarcodeProvider provider = new CountingAbsentBarcodeProvider();
        MetadataSearchService service = new MetadataSearchService(List.of(), List.of(provider), new CatalogSearchService(repository));

        assertThat(service.lookupByBarcode(MANGA, "9780000000000")).isEmpty();
        assertThat(service.lookupByBarcode(MANGA, "9780000000000")).isEmpty();

        assertThat(provider.callCount).as("une absence constatee se memorise").isEqualTo(1);
    }

    @Test
    void a_provider_that_could_not_answer_is_asked_again() {
        // Le pendant, et le plus important des deux : memoriser une PANNE
        // rendrait l'echec en cache au lieu de retenter, et un incident d'une
        // seconde se figerait pour une demi-heure.
        FakeEntityRepository repository = new FakeEntityRepository(List.of());
        CountingUnavailableBarcodeProvider provider = new CountingUnavailableBarcodeProvider();
        MetadataSearchService service = new MetadataSearchService(List.of(), List.of(provider), new CatalogSearchService(repository));

        service.lookupByBarcode(MANGA, "9780000000000");
        service.lookupByBarcode(MANGA, "9780000000000");

        assertThat(provider.callCount).as("une panne ne se memorise jamais").isEqualTo(2);
    }

    @Test
    void one_database_in_failure_is_enough_to_refuse_caching_the_absence() {
        // « Google Books ne connait pas ce code » ne dit rien tant qu'Open
        // Library n'a pas pu repondre : la conclusion demande que TOUTES les
        // bases competentes se soient prononcees.
        FakeEntityRepository repository = new FakeEntityRepository(List.of());
        CountingAbsentBarcodeProvider repond = new CountingAbsentBarcodeProvider();
        CountingUnavailableBarcodeProvider muet = new CountingUnavailableBarcodeProvider();
        MetadataSearchService service = new MetadataSearchService(List.of(), List.of(repond, muet), new CatalogSearchService(repository));

        service.lookupByBarcode(MANGA, "9780000000000");
        service.lookupByBarcode(MANGA, "9780000000000");

        assertThat(repond.callCount).isEqualTo(2);
        assertThat(muet.callCount).isEqualTo(2);
    }

    @Test
    void a_provider_that_cannot_tell_the_difference_is_treated_as_a_failure() {
        // Le defaut de l'interface : sans lookupDetailed, un vide n'est jamais
        // concluant. C'est le comportement prudent, et celui d'avant.
        FakeEntityRepository repository = new FakeEntityRepository(List.of());
        SilentBarcodeProvider muet = new SilentBarcodeProvider();
        MetadataSearchService service = new MetadataSearchService(List.of(), List.of(muet), new CatalogSearchService(repository));

        service.lookupByBarcode(MANGA, "9780000000000");
        service.lookupByBarcode(MANGA, "9780000000000");

        assertThat(muet.callCount).isEqualTo(2);
    }

    private static MetadataCandidate candidate(String title) {
        return new MetadataCandidate("FAKE", title, title, null, Map.of());
    }

    private static MetadataCandidate candidate(String title, String externalId) {
        return new MetadataCandidate("FAKE", externalId, title, null, Map.of());
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

    /** Simule une panne réseau transitoire (empty) au premier appel, puis un
     * vrai résultat ensuite - vérifie qu'un échec n'est jamais mis en cache. */
    /**
     * Ne rend qu'un Optional vide, sans jamais dire pourquoi - comme le faisaient
     * tous les providers avant cette passe.
     */
    private static final class SilentBarcodeProvider implements BarcodeMetadataProvider {
        int callCount = 0;

        @Override
        public boolean supports(EntityType entityType) {
            return true;
        }

        @Override
        public Optional<MetadataCandidate> lookup(String barcode) {
            callCount++;
            return Optional.empty();
        }
    }

    /** Repond, et ne connait pas le code : une absence CONSTATEE. */
    private static final class CountingAbsentBarcodeProvider implements BarcodeMetadataProvider {
        int callCount = 0;

        @Override
        public boolean supports(EntityType entityType) {
            return true;
        }

        @Override
        public Optional<MetadataCandidate> lookup(String barcode) {
            return lookupDetailed(barcode).candidateIfAny();
        }

        @Override
        public BarcodeLookup lookupDetailed(String barcode) {
            callCount++;
            return BarcodeLookup.absent();
        }
    }

    /** N'a pas pu repondre : reseau, delai, quota. */
    private static final class CountingUnavailableBarcodeProvider implements BarcodeMetadataProvider {
        int callCount = 0;

        @Override
        public boolean supports(EntityType entityType) {
            return true;
        }

        @Override
        public Optional<MetadataCandidate> lookup(String barcode) {
            return lookupDetailed(barcode).candidateIfAny();
        }

        @Override
        public BarcodeLookup lookupDetailed(String barcode) {
            callCount++;
            return BarcodeLookup.unavailable();
        }
    }

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
}
