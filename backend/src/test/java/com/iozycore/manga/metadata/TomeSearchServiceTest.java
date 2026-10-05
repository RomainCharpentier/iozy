package com.iozycore.manga.metadata;

import com.iozycore.core.domain.catalog.EntityType;
import com.iozycore.core.metadata.QuotaExceededException;
import com.iozycore.core.metadata.SourceUnavailableException;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/** The volumes and editions of a manga - tests taken out of MetadataSearchServiceTest in Batch 132. */
class TomeSearchServiceTest {

    private static final EntityType MANGA = new EntityType(UUID.randomUUID(), "MANGA", "Manga", Set.of(), Set.of());

    @Test
    void searchVolumes_aggregates_results_from_every_supporting_provider() {
        FakeVolumeSearchProvider provider = new FakeVolumeSearchProvider(
                List.of(new VolumeCandidate("Kana", 1, "http://cover/1.jpg", "Death Note - Tome 1")));
        TomeSearchService service =
                new TomeSearchService(List.of(provider), new FakeVolumeSearchCacheRepository());

        VolumeSearchResult result = service.searchVolumes(MANGA, "Death Note", "Ohba");

        assertThat(result.volumes()).hasSize(1);
        assertThat(result.volumes().get(0).edition()).isEqualTo("Kana");
        assertThat(result.providerUnavailable()).isFalse();
    }

    @Test
    void reports_quota_exceeded_when_a_provider_fails_with_no_usable_result() {
        // Real case that motivates VolumeSearchResult (see history): a
        // Google Books quota exceeded during the volume search
        // looked, on the client side, like "no edition found" -
        // telling them apart lets us show a suitable message.
        FakeVolumeSearchProvider provider = new FakeVolumeSearchProvider(new QuotaExceededException("quota dépassé"));
        TomeSearchService service =
                new TomeSearchService(List.of(provider), new FakeVolumeSearchCacheRepository());

        VolumeSearchResult result = service.searchVolumes(MANGA, "Death Note", "Ohba");

        assertThat(result.volumes()).isEmpty();
        assertThat(result.providerUnavailable()).isTrue();
    }

    @Test
    void reports_a_provider_that_did_not_answer_at_all_and_never_caches_that_emptiness() {
        // Flaw seen on 2026-08-27 (see Batch 58): Google Books answered
        // 503 during a "Retrouver 1 jaquette" on Naruto. The empty list that
        // resulted was (a) shown as "Aucune trouvée cette fois.",
        // (b) cached DURABLY - so the button stayed powerless even
        // once the source was back. An outage is not remembered.
        FakeVolumeSearchCacheRepository durableStorage = new FakeVolumeSearchCacheRepository();
        FakeVolumeSearchProvider provider = new FakeVolumeSearchProvider(new SourceUnavailableException("503"));
        TomeSearchService service = new TomeSearchService(List.of(provider), durableStorage);

        VolumeSearchResult result = service.searchVolumes(MANGA, "Naruto", "Kishimoto");

        assertThat(result.volumes()).isEmpty();
        assertThat(result.providerUnavailable()).isTrue();
        assertThat(durableStorage.find(MANGA.id(), "naruto", "kishimoto")).isEmpty();

        // And the next search does call the provider again, instead of being
        // served by a remembered empty result.
        service.searchVolumes(MANGA, "Naruto", "Kishimoto");
        assertThat(provider.callCount).isEqualTo(2);
    }

    @Test
    void keeps_the_most_precise_publication_date_when_two_providers_know_the_same_tome() {
        // The BnF comes first and only dates to the year; Google Books
        // knows the day. The releases calendar (batch 146) needs the
        // day, whatever the order of providers - with or without
        // a cover on the BnF side (recent records have one).
        FakeVolumeSearchProvider bnf = new FakeVolumeSearchProvider(List.of(
                new VolumeCandidate("Kana", 72, "https://bnf/72.jpg", "Naruto 72", "9782505000723", 2026, "2026"),
                new VolumeCandidate("Kana", 73, null, "Naruto 73", null, 2026, "2026")));
        FakeVolumeSearchProvider googleBooks = new FakeVolumeSearchProvider(List.of(
                new VolumeCandidate("Kana", 72, "https://gb/72.jpg", "Naruto - Tome 72", null, 2026, "2026-10-14"),
                new VolumeCandidate("Kana", 73, "https://gb/73.jpg", "Naruto - Tome 73", null, 2026, "2026-12")));
        TomeSearchService service = new TomeSearchService(List.of(bnf, googleBooks), new FakeVolumeSearchCacheRepository());

        List<VolumeCandidate> volumes = service.searchVolumes(MANGA, "Naruto", "Kishimoto").volumes();

        assertThat(volumes).hasSize(2);
        VolumeCandidate tome72 = volumes.stream().filter(v -> v.volumeNumber() == 72).findFirst().orElseThrow();
        VolumeCandidate tome73 = volumes.stream().filter(v -> v.volumeNumber() == 73).findFirst().orElseThrow();
        // The first one met keeps its fields (cover, ISBN), and takes the day.
        assertThat(tome72.imageUrl()).isEqualTo("https://bnf/72.jpg");
        assertThat(tome72.isbn()).isEqualTo("9782505000723");
        assertThat(tome72.releaseDate()).isEqualTo("2026-10-14");
        // Without a cover, it takes the second one's - and its date, which is more precise.
        assertThat(tome73.imageUrl()).isEqualTo("https://gb/73.jpg");
        assertThat(tome73.releaseDate()).isEqualTo("2026-12");
    }

    @Test
    void does_not_lose_another_providers_results_when_one_provider_hits_its_quota() {
        FakeVolumeSearchProvider failing = new FakeVolumeSearchProvider(new QuotaExceededException("quota dépassé"));
        FakeVolumeSearchProvider succeeding = new FakeVolumeSearchProvider(
                List.of(new VolumeCandidate("Kana", 1, null, "Death Note - Tome 1")));
        TomeSearchService service = new TomeSearchService(List.of(failing, succeeding), new FakeVolumeSearchCacheRepository());

        VolumeSearchResult result = service.searchVolumes(MANGA, "Death Note", "Ohba");

        assertThat(result.volumes()).hasSize(1); // the result of "succeeding" is not lost
        assertThat(result.providerUnavailable()).isTrue(); // but the quota exceeded elsewhere is still reported
    }

    @Test
    void caches_a_genuine_empty_volume_search_so_a_later_call_does_not_hit_the_provider_again() {
        // Optimisation added after noticing (see history) that a
        // series with no French edition re-ran the 8 Google Books requests
        // on EVERY search, indefinitely, without ever being remembered -
        // unlike barcodeCache/frenchTitleCache, an empty list IS
        // now a result like any other for volumeSearchCache as long
        // as the quota is not the cause (see the next test).
        FakeVolumeSearchProvider provider = new FakeVolumeSearchProvider(List.of());
        TomeSearchService service =
                new TomeSearchService(List.of(provider), new FakeVolumeSearchCacheRepository());

        VolumeSearchResult first = service.searchVolumes(MANGA, "Un titre introuvable", null);
        VolumeSearchResult second = service.searchVolumes(MANGA, "Un titre introuvable", null);

        assertThat(first.volumes()).isEmpty();
        assertThat(second.volumes()).isEmpty();
        assertThat(provider.callCount).isEqualTo(1); // served by the cache on the 2nd call
    }

    @Test
    void never_caches_an_empty_result_caused_by_a_quota_failure_so_a_later_retry_can_still_succeed() {
        // A transient failure (quota, timeout...) must never condemn
        // the same search for 24h - same principle already in place for
        // barcodeCache/frenchTitleCache.
        FakeVolumeSearchProvider provider = new FakeVolumeSearchProvider(new QuotaExceededException("quota dépassé"));
        TomeSearchService service =
                new TomeSearchService(List.of(provider), new FakeVolumeSearchCacheRepository());

        service.searchVolumes(MANGA, "Death Note", "Ohba");
        service.searchVolumes(MANGA, "Death Note", "Ohba");

        assertThat(provider.callCount).isEqualTo(2); // never served by the cache
    }

    @Test
    void caches_a_successful_volume_search_so_a_later_call_does_not_hit_the_provider_again() {
        FakeVolumeSearchProvider provider = new FakeVolumeSearchProvider(
                List.of(new VolumeCandidate("Kana", 1, null, "Death Note - Tome 1")));
        TomeSearchService service =
                new TomeSearchService(List.of(provider), new FakeVolumeSearchCacheRepository());

        service.searchVolumes(MANGA, "Death Note", "Ohba");
        service.searchVolumes(MANGA, "Death Note", "Ohba");

        assertThat(provider.callCount).isEqualTo(1);
    }

    @Test
    void a_volume_search_already_in_durable_storage_never_calls_the_provider_even_on_a_fresh_service_instance() {
        // Simulates a backend restart: the memory cache (TtlCache) is
        // rebuilt empty, but the durable storage (database) survives -
        // two distinct instances of TomeSearchService share the same repo.
        FakeVolumeSearchCacheRepository durableStorage = new FakeVolumeSearchCacheRepository();
        FakeVolumeSearchProvider provider = new FakeVolumeSearchProvider(
                List.of(new VolumeCandidate("Kana", 1, null, "Death Note - Tome 1")));
        TomeSearchService firstInstance =
                new TomeSearchService(List.of(provider), durableStorage);
        firstInstance.searchVolumes(MANGA, "Death Note", "Ohba");

        TomeSearchService afterRestart =
                new TomeSearchService(List.of(provider), durableStorage);
        afterRestart.searchVolumes(MANGA, "Death Note", "Ohba");

        assertThat(provider.callCount).isEqualTo(1); // the "restart" did not call Google Books again
    }

    @Test
    void force_refresh_bypasses_both_caches_and_overwrites_the_durable_storage() {
        FakeVolumeSearchCacheRepository durableStorage = new FakeVolumeSearchCacheRepository();
        FakeVolumeSearchProvider provider = new FakeVolumeSearchProvider(
                List.of(new VolumeCandidate("Kana", 1, null, "Death Note - Tome 1")));
        TomeSearchService service =
                new TomeSearchService(List.of(provider), durableStorage);
        service.searchVolumes(MANGA, "Death Note", "Ohba");

        provider.results = List.of(new VolumeCandidate("Kana", 1, null, "Death Note - Tome 1"),
                new VolumeCandidate("Kana", 2, null, "Death Note - Tome 2")); // new edition released since
        VolumeSearchResult withoutRefresh = service.searchVolumes(MANGA, "Death Note", "Ohba");
        VolumeSearchResult withRefresh = service.searchVolumes(MANGA, "Death Note", "Ohba", true);

        assertThat(withoutRefresh.volumes()).hasSize(1); // served by the cache, ignores the change
        assertThat(withRefresh.volumes()).hasSize(2); // "Actualiser" does call Google Books again
        assertThat(provider.callCount).isEqualTo(2);
    }

    @Test
    void search_additional_editions_merges_with_the_already_cached_quick_result() {
        // Quick search first (puts "Kana" in the cache), then "Chercher plus
        // d'éditions" (see the client-side button) must ADD "Perfect
        // Edition" to the already known result, not replace it.
        FakeVolumeSearchProvider provider = new FakeVolumeSearchProvider(
                List.of(new VolumeCandidate("Kana", 1, null, "Death Note - Tome 1")));
        provider.additionalResults = List.of(new VolumeCandidate("Perfect Edition", 1, null, "Death Note Perfect Edition - Tome 1"));
        TomeSearchService service =
                new TomeSearchService(List.of(provider), new FakeVolumeSearchCacheRepository());
        service.searchVolumes(MANGA, "Death Note", "Ohba");

        VolumeSearchResult result = service.searchAdditionalEditions(MANGA, "Death Note", "Ohba");

        assertThat(result.volumes()).extracting(VolumeCandidate::edition).containsExactlyInAnyOrder("Kana", "Perfect Edition");
        assertThat(provider.additionalCallCount).isEqualTo(1);
        assertThat(provider.callCount).isEqualTo(1); // searchVolumes (quick) is NOT called again
    }

    @Test
    void search_additional_editions_persists_the_merged_result_so_it_is_not_lost_on_a_later_quick_search() {
        FakeVolumeSearchCacheRepository durableStorage = new FakeVolumeSearchCacheRepository();
        FakeVolumeSearchProvider provider = new FakeVolumeSearchProvider(
                List.of(new VolumeCandidate("Kana", 1, null, "Death Note - Tome 1")));
        provider.additionalResults = List.of(new VolumeCandidate("Perfect Edition", 1, null, "Death Note Perfect Edition - Tome 1"));
        TomeSearchService service =
                new TomeSearchService(List.of(provider), durableStorage);
        service.searchVolumes(MANGA, "Death Note", "Ohba");
        service.searchAdditionalEditions(MANGA, "Death Note", "Ohba");

        VolumeSearchResult laterQuickSearch = service.searchVolumes(MANGA, "Death Note", "Ohba");

        assertThat(laterQuickSearch.volumes()).hasSize(2); // "Perfect Edition" is kept, not just "Kana"
        assertThat(provider.callCount).isEqualTo(1); // never called again, served by the already merged cache
    }

    @Test
    void does_not_persist_the_merge_when_the_additional_search_hits_its_quota() {
        FakeVolumeSearchCacheRepository durableStorage = new FakeVolumeSearchCacheRepository();
        FakeVolumeSearchProvider provider = new FakeVolumeSearchProvider(
                List.of(new VolumeCandidate("Kana", 1, null, "Death Note - Tome 1")));
        provider.additionalFailure = new QuotaExceededException("quota dépassé");
        TomeSearchService service =
                new TomeSearchService(List.of(provider), durableStorage);
        service.searchVolumes(MANGA, "Death Note", "Ohba");

        VolumeSearchResult result = service.searchAdditionalEditions(MANGA, "Death Note", "Ohba");

        assertThat(result.volumes()).hasSize(1); // the already known result is still returned
        assertThat(result.providerUnavailable()).isTrue();
        assertThat(durableStorage.find(MANGA.id(), "death note", "ohba")).hasValueSatisfying(
                volumes -> assertThat(volumes).hasSize(1)); // not overwritten by a failure
    }

    // ------------------------------------ The secondary editions (batch 144)

    @Test
    void completes_a_secondary_edition_by_searching_it_by_name_and_files_the_finds_under_it() {
        // Measured on 2026-09-05: Naruto, Kana 72 and Hokage 19 out of 36 - the BnF
        // only holds the Hokage edition halfway, and the volume-by-volume probe only
        // fills the numbers missing from ALL the editions.
        List<VolumeCandidate> bnf = new ArrayList<>();
        for (int i = 1; i <= 5; i++) {
            bnf.add(new VolumeCandidate("Kana", i, null, "Naruto T" + i, "978250500000" + i, 2002));
        }
        bnf.add(new VolumeCandidate("Hokage", 1, null, "Naruto Hokage T1", "9782505111111", 2022));
        bnf.add(new VolumeCandidate("Hokage", 2, null, "Naruto Hokage T2", "9782505111112", 2022));
        FakeVolumeSearchProvider provider = new FakeVolumeSearchProvider(bnf);
        provider.editionResults = Map.of("Hokage", List.of(
                // already there: must not be doubled
                new VolumeCandidate("Edition Hokage", 2, "http://c/2.jpg", "Naruto Edition Hokage Tome 2"),
                // new: joins "Hokage", not a second edition "Edition Hokage"
                new VolumeCandidate("Edition Hokage", 3, "http://c/3.jpg", "Naruto Edition Hokage Tome 3"),
                // the same request also returns the plain edition: nothing to do here
                new VolumeCandidate("Kana", 4, null, "Naruto Tome 4")));
        TomeSearchService service = new TomeSearchService(List.of(provider), new FakeVolumeSearchCacheRepository());

        VolumeSearchResult result = service.searchVolumes(MANGA, "Naruto", "Kishimoto");

        assertThat(provider.editionCalls).containsExactly("Hokage"); // never the main edition
        assertThat(result.volumes().stream().filter(v -> v.edition().equals("Hokage")).map(VolumeCandidate::volumeNumber).sorted().toList())
                .containsExactly(1, 2, 3);
        assertThat(result.volumes().stream().filter(v -> v.edition().equals("Kana")).count()).isEqualTo(5);
        assertThat(result.volumes()).extracting(VolumeCandidate::edition).doesNotContain("Edition Hokage");
    }

    @Test
    void does_not_search_editions_by_name_when_the_series_has_only_one() {
        FakeVolumeSearchProvider provider = new FakeVolumeSearchProvider(List.of(
                new VolumeCandidate("Kana", 1, null, "Death Note T1"), new VolumeCandidate("Kana", 2, null, "Death Note T2")));
        provider.editionResults = Map.of("Kana", List.of(new VolumeCandidate("Kana", 3, null, "Death Note T3")));
        TomeSearchService service = new TomeSearchService(List.of(provider), new FakeVolumeSearchCacheRepository());

        service.searchVolumes(MANGA, "Death Note", "Ohba");

        assertThat(provider.editionCalls).isEmpty();
    }

    @Test
    void a_quota_hit_while_completing_an_edition_keeps_what_was_found_and_does_not_freeze_it() {
        FakeVolumeSearchCacheRepository durableStorage = new FakeVolumeSearchCacheRepository();
        FakeVolumeSearchProvider provider = new FakeVolumeSearchProvider(List.of(
                new VolumeCandidate("Kana", 1, null, "Naruto T1"), new VolumeCandidate("Kana", 2, null, "Naruto T2"),
                new VolumeCandidate("Kana", 3, null, "Naruto T3"),
                new VolumeCandidate("Hokage", 1, null, "Naruto Hokage T1"), new VolumeCandidate("Hokage", 2, null, "Naruto Hokage T2")));
        provider.editionFailure = new QuotaExceededException("quota");
        TomeSearchService service = new TomeSearchService(List.of(provider), durableStorage);

        VolumeSearchResult result = service.searchVolumes(MANGA, "Naruto", "Kishimoto");

        assertThat(result.volumes()).hasSize(5);
        assertThat(result.providerUnavailable()).isTrue();
        assertThat(durableStorage.find(MANGA.id(), "naruto", "kishimoto")).isEmpty(); // nothing frozen during the outage
    }

    private static final class FakeVolumeSearchProvider implements VolumeSearchProvider {
        // Deliberately mutable (not final): force_refresh_bypasses_both_caches
        // simulates a new release between two calls.
        List<VolumeCandidate> results;
        // Non-null: simulates a provider that always fails (see
        // reports_quota_exceeded_when_a_provider_fails_with_no_usable_result).
        private final RuntimeException failure;
        int callCount = 0;
        // Result/failure of searchAdditionalEditions - distinct from results/failure
        // (quick search): the two methods are called separately by
        // TomeSearchService depending on the user's action.
        List<VolumeCandidate> additionalResults = List.of();
        RuntimeException additionalFailure;
        int additionalCallCount = 0;
        // The editions searched by their name (batch 144): name -> records returned.
        Map<String, List<VolumeCandidate>> editionResults = Map.of();
        RuntimeException editionFailure;
        final List<String> editionCalls = new ArrayList<>();

        FakeVolumeSearchProvider(List<VolumeCandidate> results) {
            this.results = results;
            this.failure = null;
        }

        FakeVolumeSearchProvider(RuntimeException failure) {
            this.results = List.of();
            this.failure = failure;
        }

        @Override
        public boolean supports(EntityType entityType) {
            return "MANGA".equals(entityType.code());
        }

        // excludedTitleFragments ignored here: covered by
        // GoogleBooksVolumeSearchProviderTest, this fake does not need to
        // check it again at the service level.
        @Override
        public List<VolumeCandidate> searchVolumes(String seriesTitle, String author, List<String> excludedTitleFragments) {
            callCount++;
            if (failure != null) {
                throw failure;
            }
            return results;
        }

        @Override
        public List<VolumeCandidate> searchAdditionalEditions(String seriesTitle, String author, List<String> excludedTitleFragments) {
            additionalCallCount++;
            if (additionalFailure != null) {
                throw additionalFailure;
            }
            return additionalResults;
        }

        @Override
        public List<VolumeCandidate> searchEdition(String seriesTitle, String author, String editionName, List<String> excludedTitleFragments) {
            editionCalls.add(editionName);
            if (editionFailure != null) {
                throw editionFailure;
            }
            return editionResults.getOrDefault(editionName, List.of());
        }
    }

    /** Simulates the volume_search_cache table (V3__volume_search_cache.sql) - a
     * simple in-memory Map is enough to check that TomeSearchService reads/writes
     * this storage properly, without needing a real database for this unit test. */
    private static final class FakeVolumeSearchCacheRepository implements VolumeSearchCacheRepository {
        private final Map<String, List<VolumeCandidate>> store = new java.util.HashMap<>();

        @Override
        public Optional<List<VolumeCandidate>> find(UUID entityTypeId, String seriesTitle, String author) {
            return Optional.ofNullable(store.get(entityTypeId + "|" + seriesTitle + "|" + author));
        }

        @Override
        public void save(UUID entityTypeId, String seriesTitle, String author, List<VolumeCandidate> volumes) {
            store.put(entityTypeId + "|" + seriesTitle + "|" + author, volumes);
        }

        @Override
        public void delete(UUID entityTypeId, String seriesTitle, String author) {
            store.remove(entityTypeId + "|" + seriesTitle + "|" + author);
        }

        @Override
        public List<StoredVolumeSearch> findAllByEntityTypeIdAndSeriesTitleIn(UUID entityTypeId, java.util.Collection<String> seriesTitles) {
            List<StoredVolumeSearch> result = new java.util.ArrayList<>();
            for (Map.Entry<String, List<VolumeCandidate>> entry : store.entrySet()) {
                String[] parts = entry.getKey().split("\\|", -1);
                if (parts[0].equals(entityTypeId.toString()) && seriesTitles.contains(parts[1])) {
                    result.add(new StoredVolumeSearch(parts[1], parts[2], entry.getValue(), java.time.Instant.now()));
                }
            }
            return result;
        }

        @Override
        public List<StoredVolumeSearchKey> findKeysByEntityTypeId(UUID entityTypeId) {
            List<StoredVolumeSearchKey> result = new java.util.ArrayList<>();
            for (String key : store.keySet()) {
                String[] parts = key.split("\\|", -1);
                if (parts[0].equals(entityTypeId.toString())) {
                    result.add(new StoredVolumeSearchKey(parts[1], parts[2], java.time.Instant.now()));
                }
            }
            return result;
        }
    }
}
