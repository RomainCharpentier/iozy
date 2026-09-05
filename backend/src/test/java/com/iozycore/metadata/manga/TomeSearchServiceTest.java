package com.iozycore.metadata.manga;

import com.iozycore.domain.catalog.EntityType;
import com.iozycore.metadata.QuotaExceededException;
import com.iozycore.metadata.SourceUnavailableException;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/** Les tomes et editions d'un manga - tests extraits de MetadataSearchServiceTest au Lot 132. */
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
        // Cas réel qui motive VolumeSearchResult (voir historique) : un
        // quota Google Books dépassé pendant la recherche de tomes
        // ressemblait, côté client, à "aucune édition trouvée" - le
        // distinguer permet d'afficher un message adapté.
        FakeVolumeSearchProvider provider = new FakeVolumeSearchProvider(new QuotaExceededException("quota dépassé"));
        TomeSearchService service =
                new TomeSearchService(List.of(provider), new FakeVolumeSearchCacheRepository());

        VolumeSearchResult result = service.searchVolumes(MANGA, "Death Note", "Ohba");

        assertThat(result.volumes()).isEmpty();
        assertThat(result.providerUnavailable()).isTrue();
    }

    @Test
    void reports_a_provider_that_did_not_answer_at_all_and_never_caches_that_emptiness() {
        // Défaut constaté le 2026-08-27 (voir Lot 58) : Google Books a répondu
        // 503 pendant un « Retrouver 1 jaquette » sur Naruto. La liste vide qui
        // en résultait était (a) affichée comme « Aucune trouvée cette fois. »,
        // (b) mise en cache DURABLEMENT - le bouton restait donc impuissant même
        // une fois la source rétablie. Une panne ne se mémorise pas.
        FakeVolumeSearchCacheRepository durableStorage = new FakeVolumeSearchCacheRepository();
        FakeVolumeSearchProvider provider = new FakeVolumeSearchProvider(new SourceUnavailableException("503"));
        TomeSearchService service = new TomeSearchService(List.of(provider), durableStorage);

        VolumeSearchResult result = service.searchVolumes(MANGA, "Naruto", "Kishimoto");

        assertThat(result.volumes()).isEmpty();
        assertThat(result.providerUnavailable()).isTrue();
        assertThat(durableStorage.find(MANGA.id(), "naruto", "kishimoto")).isEmpty();

        // Et la recherche suivante rappelle bien le fournisseur, au lieu d'être
        // servie par un vide mémorisé.
        service.searchVolumes(MANGA, "Naruto", "Kishimoto");
        assertThat(provider.callCount).isEqualTo(2);
    }

    @Test
    void does_not_lose_another_providers_results_when_one_provider_hits_its_quota() {
        FakeVolumeSearchProvider failing = new FakeVolumeSearchProvider(new QuotaExceededException("quota dépassé"));
        FakeVolumeSearchProvider succeeding = new FakeVolumeSearchProvider(
                List.of(new VolumeCandidate("Kana", 1, null, "Death Note - Tome 1")));
        TomeSearchService service = new TomeSearchService(List.of(failing, succeeding), new FakeVolumeSearchCacheRepository());

        VolumeSearchResult result = service.searchVolumes(MANGA, "Death Note", "Ohba");

        assertThat(result.volumes()).hasSize(1); // le résultat de "succeeding" n'est pas perdu
        assertThat(result.providerUnavailable()).isTrue(); // mais le quota dépassé ailleurs reste signalé
    }

    @Test
    void caches_a_genuine_empty_volume_search_so_a_later_call_does_not_hit_the_provider_again() {
        // Optimisation ajoutée après avoir constaté (voir historique) qu'une
        // série sans édition française relançait les 8 requêtes Google Books
        // à CHAQUE recherche, indéfiniment, sans jamais être mémorisée -
        // contrairement à barcodeCache/frenchTitleCache, une liste vide EST
        // désormais un résultat comme un autre pour volumeSearchCache tant
        // que ce n'est pas le quota qui en est la cause (voir le test suivant).
        FakeVolumeSearchProvider provider = new FakeVolumeSearchProvider(List.of());
        TomeSearchService service =
                new TomeSearchService(List.of(provider), new FakeVolumeSearchCacheRepository());

        VolumeSearchResult first = service.searchVolumes(MANGA, "Un titre introuvable", null);
        VolumeSearchResult second = service.searchVolumes(MANGA, "Un titre introuvable", null);

        assertThat(first.volumes()).isEmpty();
        assertThat(second.volumes()).isEmpty();
        assertThat(provider.callCount).isEqualTo(1); // servi par le cache au 2e appel
    }

    @Test
    void never_caches_an_empty_result_caused_by_a_quota_failure_so_a_later_retry_can_still_succeed() {
        // Un échec transitoire (quota, timeout...) ne doit jamais condamner
        // la même recherche pendant 24h - même principe déjà en place pour
        // barcodeCache/frenchTitleCache.
        FakeVolumeSearchProvider provider = new FakeVolumeSearchProvider(new QuotaExceededException("quota dépassé"));
        TomeSearchService service =
                new TomeSearchService(List.of(provider), new FakeVolumeSearchCacheRepository());

        service.searchVolumes(MANGA, "Death Note", "Ohba");
        service.searchVolumes(MANGA, "Death Note", "Ohba");

        assertThat(provider.callCount).isEqualTo(2); // jamais servi par le cache
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
        // Simule un redémarrage du backend : le cache mémoire (TtlCache) est
        // reconstruit à vide, mais le stockage durable (base de données) survit -
        // deux instances distinctes de TomeSearchService partagent le même repo.
        FakeVolumeSearchCacheRepository durableStorage = new FakeVolumeSearchCacheRepository();
        FakeVolumeSearchProvider provider = new FakeVolumeSearchProvider(
                List.of(new VolumeCandidate("Kana", 1, null, "Death Note - Tome 1")));
        TomeSearchService firstInstance =
                new TomeSearchService(List.of(provider), durableStorage);
        firstInstance.searchVolumes(MANGA, "Death Note", "Ohba");

        TomeSearchService afterRestart =
                new TomeSearchService(List.of(provider), durableStorage);
        afterRestart.searchVolumes(MANGA, "Death Note", "Ohba");

        assertThat(provider.callCount).isEqualTo(1); // le "redémarrage" n'a pas relancé Google Books
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
                new VolumeCandidate("Kana", 2, null, "Death Note - Tome 2")); // nouvelle édition parue depuis
        VolumeSearchResult withoutRefresh = service.searchVolumes(MANGA, "Death Note", "Ohba");
        VolumeSearchResult withRefresh = service.searchVolumes(MANGA, "Death Note", "Ohba", true);

        assertThat(withoutRefresh.volumes()).hasSize(1); // servi par le cache, ignore le changement
        assertThat(withRefresh.volumes()).hasSize(2); // "Actualiser" relance bien Google Books
        assertThat(provider.callCount).isEqualTo(2);
    }

    @Test
    void search_additional_editions_merges_with_the_already_cached_quick_result() {
        // Recherche rapide d'abord (met "Kana" en cache), puis "Chercher plus
        // d'éditions" (voir bouton côté client) doit AJOUTER "Perfect
        // Edition" au résultat déjà connu, pas le remplacer.
        FakeVolumeSearchProvider provider = new FakeVolumeSearchProvider(
                List.of(new VolumeCandidate("Kana", 1, null, "Death Note - Tome 1")));
        provider.additionalResults = List.of(new VolumeCandidate("Perfect Edition", 1, null, "Death Note Perfect Edition - Tome 1"));
        TomeSearchService service =
                new TomeSearchService(List.of(provider), new FakeVolumeSearchCacheRepository());
        service.searchVolumes(MANGA, "Death Note", "Ohba");

        VolumeSearchResult result = service.searchAdditionalEditions(MANGA, "Death Note", "Ohba");

        assertThat(result.volumes()).extracting(VolumeCandidate::edition).containsExactlyInAnyOrder("Kana", "Perfect Edition");
        assertThat(provider.additionalCallCount).isEqualTo(1);
        assertThat(provider.callCount).isEqualTo(1); // searchVolumes (rapide) n'est PAS rappelé
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

        assertThat(laterQuickSearch.volumes()).hasSize(2); // "Perfect Edition" reste acquis, pas juste "Kana"
        assertThat(provider.callCount).isEqualTo(1); // jamais rappelé, servi par le cache déjà fusionné
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

        assertThat(result.volumes()).hasSize(1); // le résultat déjà connu reste renvoyé
        assertThat(result.providerUnavailable()).isTrue();
        assertThat(durableStorage.find(MANGA.id(), "death note", "ohba")).hasValueSatisfying(
                volumes -> assertThat(volumes).hasSize(1)); // pas écrasé par un échec
    }

    private static final class FakeVolumeSearchProvider implements VolumeSearchProvider {
        // Volontairement mutable (pas final) : force_refresh_bypasses_both_caches
        // simule une nouvelle parution entre deux appels.
        List<VolumeCandidate> results;
        // Non-null : simule un fournisseur qui échoue systématiquement (voir
        // reports_quota_exceeded_when_a_provider_fails_with_no_usable_result).
        private final RuntimeException failure;
        int callCount = 0;
        // Résultat/échec de searchAdditionalEditions - distinct de results/failure
        // (recherche rapide) : les deux méthodes sont appelées séparément par
        // TomeSearchService selon l'action de l'utilisateur.
        List<VolumeCandidate> additionalResults = List.of();
        RuntimeException additionalFailure;
        int additionalCallCount = 0;

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

        // excludedTitleFragments ignoré ici : couvert par
        // GoogleBooksVolumeSearchProviderTest, cette fake n'a pas besoin de le
        // vérifier à nouveau au niveau du service.
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
    }

    /** Simule la table volume_search_cache (V3__volume_search_cache.sql) - une
     * simple Map en mémoire suffit à vérifier que TomeSearchService lit/écrit
     * bien ce stockage, sans avoir besoin d'une vraie base pour ce test unitaire. */
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
    }
}
