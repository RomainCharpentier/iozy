package com.iozycore.core.metadata;

import com.iozycore.core.domain.catalog.Entity;
import com.iozycore.core.domain.catalog.EntityRepository;
import com.iozycore.core.domain.catalog.EntityType;
import com.iozycore.core.metadata.catalog.CatalogSearchService;
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
                candidate("Naruto"),          // already owned (case-insensitive comparison)
                candidate("Boruto")));         // not yet owned

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
        service.search(MANGA, "NARUTO"); // same query up to case - must remain a cache hit

        assertThat(provider.callCount).isEqualTo(1);
    }

    @Test
    void a_newly_added_entity_is_excluded_even_though_the_underlying_search_is_served_from_cache() {
        FakeEntityRepository repository = new FakeEntityRepository(List.of());
        FakeMetadataProvider provider = new FakeMetadataProvider(List.of(candidate("Naruto"), candidate("Boruto")));
        MetadataSearchService service = new MetadataSearchService(List.of(provider), List.of(), new CatalogSearchService(repository));

        List<MetadataCandidate> beforeOwning = service.search(MANGA, "naruto");
        repository.entities.add(Entity.create(MANGA.id(), "Naruto")); // added between the two calls
        List<MetadataCandidate> afterOwning = service.search(MANGA, "naruto");

        assertThat(beforeOwning).extracting(MetadataCandidate::title).containsExactlyInAnyOrder("Naruto", "Boruto");
        assertThat(afterOwning).extracting(MetadataCandidate::title).containsExactly("Boruto");
        assertThat(provider.callCount).isEqualTo(1); // the second call remains a cache hit on the provider side
    }

    @Test
    void keeps_an_already_owned_title_when_the_caller_asks_for_it() {
        // The filter serves the ADD screen. Reloading the information of a detail page
        // asks the opposite question - "what does the source know about THIS work?" -
        // and the filter guaranteed zero matches by construction there:
        // on Naruto, the search returned eight derivatives and never the series.
        FakeEntityRepository repository = new FakeEntityRepository(List.of(Entity.create(MANGA.id(), "Naruto")));
        FakeMetadataProvider provider = new FakeMetadataProvider(List.of(candidate("Naruto"), candidate("Boruto")));
        MetadataSearchService service = new MetadataSearchService(List.of(provider), List.of(), new CatalogSearchService(repository));

        assertThat(service.search(MANGA, "naruto")).extracting(MetadataCandidate::title).containsExactly("Boruto");
        assertThat(service.search(MANGA, "naruto", true)).extracting(MetadataCandidate::title)
                .containsExactlyInAnyOrder("Naruto", "Boruto");
    }

    @Test
    void deduplicates_candidates_with_the_same_title_across_providers_keeping_the_first_providers_result() {
        // Real case observed (see history): "Naruto", unchanged in
        // French, comes out of both Jikan/MyAnimeList and
        // GoogleBooksTitleSearchProvider - two identical entries in the
        // list, of no interest to the user.
        FakeMetadataProvider richProvider = new FakeMetadataProvider(List.of(candidate("Naruto")));
        FakeMetadataProvider poorProvider = new FakeMetadataProvider(
                List.of(new MetadataCandidate("GOOGLE_BOOKS", "gb1", "naruto", null, Map.of())));
        MetadataSearchService service = new MetadataSearchService(List.of(richProvider, poorProvider), List.of(), new CatalogSearchService(new FakeEntityRepository(List.of())));

        List<MetadataCandidate> results = service.search(MANGA, "naruto");

        assertThat(results).hasSize(1); // not two "Naruto" entries
        assertThat(results.get(0).source()).isEqualTo("FAKE"); // the first provider in the list wins
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

        Optional<MetadataCandidate> firstAttempt = service.lookupByBarcode(MANGA, "9780000000000"); // simulated network failure
        Optional<MetadataCandidate> secondAttempt = service.lookupByBarcode(MANGA, "9780000000000"); // retry that succeeds

        assertThat(firstAttempt).isEmpty();
        assertThat(secondAttempt).isPresent();
        assertThat(provider.callCount).isEqualTo(2); // no cache hit after the failure
    }

    @Test
    void caches_a_barcode_the_databases_answered_they_do_not_know() {
        // Since the photos of a batch deliver a dozen EANs at once -
        // and an identification takes 1.4 to 5.5 s - re-querying on every
        // analysis a code known to be unfindable costs a lot for
        // nothing.
        FakeEntityRepository repository = new FakeEntityRepository(List.of());
        CountingAbsentBarcodeProvider provider = new CountingAbsentBarcodeProvider();
        MetadataSearchService service = new MetadataSearchService(List.of(), List.of(provider), new CatalogSearchService(repository));

        assertThat(service.lookupByBarcode(MANGA, "9780000000000")).isEmpty();
        assertThat(service.lookupByBarcode(MANGA, "9780000000000")).isEmpty();

        assertThat(provider.callCount).as("an observed absence is remembered").isEqualTo(1);
    }

    @Test
    void a_provider_that_could_not_answer_is_asked_again() {
        // The counterpart, and the more important of the two: remembering an OUTAGE
        // would cache the failure instead of retrying, and a one-second incident
        // would freeze for half an hour.
        FakeEntityRepository repository = new FakeEntityRepository(List.of());
        CountingUnavailableBarcodeProvider provider = new CountingUnavailableBarcodeProvider();
        MetadataSearchService service = new MetadataSearchService(List.of(), List.of(provider), new CatalogSearchService(repository));

        service.lookupByBarcode(MANGA, "9780000000000");
        service.lookupByBarcode(MANGA, "9780000000000");

        assertThat(provider.callCount).as("an outage is never remembered").isEqualTo(2);
    }

    @Test
    void one_database_in_failure_is_enough_to_refuse_caching_the_absence() {
        // "Google Books does not know this code" says nothing as long as Open
        // Library could not answer: the conclusion requires ALL the
        // competent databases to have spoken.
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
        // The interface default: without lookupDetailed, an empty is never
        // conclusive. This is the cautious behaviour, and the one from before.
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

    /** entities is deliberately mutable (defensive copy in compact constructor) -
     * some tests simulate an addition happening between two searches. */
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

    /** callCount is not a record component on purpose: it must stay
     * mutable so that the cache tests can check how many times
     * the "provider" was really called (so not served by the cache). */
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

    /** Simulates a transient network failure (empty) on the first call, then a
     * real result afterwards - checks that a failure is never cached. */
    /**
     * Returns only an empty Optional, never saying why - as all
     * providers did before this pass.
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

    /** Answers, and does not know the code: an OBSERVED absence. */
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

    /** Could not answer: network, timeout, quota. */
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
