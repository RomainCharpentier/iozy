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

        MetadataSearchService service = new MetadataSearchService(List.of(provider), List.of(), repository, List.of(), List.of(), new FakeVolumeSearchCacheRepository());

        List<MetadataCandidate> results = service.search(MANGA, "naruto");

        assertThat(results).extracting(MetadataCandidate::title).containsExactly("Boruto");
    }

    @Test
    void barcode_lookup_is_not_filtered_by_the_collection_so_a_second_copy_can_still_be_attached() {
        Entity alreadyOwned = Entity.create(MANGA.id(), "Naruto");
        FakeEntityRepository repository = new FakeEntityRepository(List.of(alreadyOwned));
        FakeBarcodeProvider barcodeProvider = new FakeBarcodeProvider(candidate("Naruto"));

        MetadataSearchService service =
                new MetadataSearchService(List.of(), List.of(barcodeProvider), repository, List.of(), List.of(), new FakeVolumeSearchCacheRepository());

        Optional<MetadataCandidate> result = service.lookupByBarcode(MANGA, "9780000000000");

        assertThat(result).isPresent();
        assertThat(result.get().title()).isEqualTo("Naruto");
    }

    @Test
    void does_not_call_the_provider_again_for_a_repeated_identical_search() {
        FakeEntityRepository repository = new FakeEntityRepository(List.of());
        FakeMetadataProvider provider = new FakeMetadataProvider(List.of(candidate("Boruto")));
        MetadataSearchService service = new MetadataSearchService(List.of(provider), List.of(), repository, List.of(), List.of(), new FakeVolumeSearchCacheRepository());

        service.search(MANGA, "naruto");
        service.search(MANGA, "NARUTO"); // même requête à la casse près - doit rester un cache hit

        assertThat(provider.callCount).isEqualTo(1);
    }

    @Test
    void a_newly_added_entity_is_excluded_even_though_the_underlying_search_is_served_from_cache() {
        FakeEntityRepository repository = new FakeEntityRepository(List.of());
        FakeMetadataProvider provider = new FakeMetadataProvider(List.of(candidate("Naruto"), candidate("Boruto")));
        MetadataSearchService service = new MetadataSearchService(List.of(provider), List.of(), repository, List.of(), List.of(), new FakeVolumeSearchCacheRepository());

        List<MetadataCandidate> beforeOwning = service.search(MANGA, "naruto");
        repository.entities.add(Entity.create(MANGA.id(), "Naruto")); // ajouté entre les deux appels
        List<MetadataCandidate> afterOwning = service.search(MANGA, "naruto");

        assertThat(beforeOwning).extracting(MetadataCandidate::title).containsExactlyInAnyOrder("Naruto", "Boruto");
        assertThat(afterOwning).extracting(MetadataCandidate::title).containsExactly("Boruto");
        assertThat(provider.callCount).isEqualTo(1); // le second appel reste un cache hit côté provider
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
        MetadataSearchService service = new MetadataSearchService(
                List.of(richProvider, poorProvider), List.of(), new FakeEntityRepository(List.of()), List.of(), List.of(),
                new FakeVolumeSearchCacheRepository());

        List<MetadataCandidate> results = service.search(MANGA, "naruto");

        assertThat(results).hasSize(1); // pas deux entrées "Naruto"
        assertThat(results.get(0).source()).isEqualTo("FAKE"); // le premier provider de la liste gagne
    }

    @Test
    void does_not_call_the_barcode_provider_again_for_a_repeated_identical_barcode() {
        FakeEntityRepository repository = new FakeEntityRepository(List.of());
        FakeBarcodeProvider barcodeProvider = new FakeBarcodeProvider(candidate("Naruto"));
        MetadataSearchService service =
                new MetadataSearchService(List.of(), List.of(barcodeProvider), repository, List.of(), List.of(), new FakeVolumeSearchCacheRepository());

        service.lookupByBarcode(MANGA, "9780000000000");
        service.lookupByBarcode(MANGA, "9780000000000");

        assertThat(barcodeProvider.callCount).isEqualTo(1);
    }

    @Test
    void does_not_call_the_french_title_provider_again_for_a_repeated_identical_query() {
        FakeEntityRepository repository = new FakeEntityRepository(List.of());
        FakeFrenchTitleProvider frenchTitleProvider = new FakeFrenchTitleProvider(Optional.of(FrenchTitleMatch.seriesMatched("L'Attaque des Titans")));
        MetadataSearchService service =
                new MetadataSearchService(List.of(), List.of(), repository, List.of(frenchTitleProvider), List.of(), new FakeVolumeSearchCacheRepository());

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
        FakeFrenchTitleProvider secondProvider = new FakeFrenchTitleProvider(Optional.of(FrenchTitleMatch.seriesMatched("L'Attaque des Titans")));
        MetadataSearchService service = new MetadataSearchService(
                List.of(), List.of(), repository, List.of(firstProvider, secondProvider), List.of(), new FakeVolumeSearchCacheRepository());

        Optional<String> result = service.findFrenchTitle(MANGA, "Shingeki no Kyojin", "Hajime Isayama");

        assertThat(result).contains("L'Attaque des Titans");
        assertThat(firstProvider.callCount).isEqualTo(1);
        assertThat(secondProvider.callCount).isEqualTo(1);
    }

    @Test
    void does_not_cache_a_failed_barcode_lookup_so_a_later_retry_can_still_succeed() {
        FakeEntityRepository repository = new FakeEntityRepository(List.of());
        StatefulBarcodeProvider provider = new StatefulBarcodeProvider(candidate("Naruto"));
        MetadataSearchService service = new MetadataSearchService(List.of(), List.of(provider), repository, List.of(), List.of(), new FakeVolumeSearchCacheRepository());

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
                new MetadataSearchService(List.of(), List.of(), repository, List.of(provider), List.of(), new FakeVolumeSearchCacheRepository());

        Optional<String> firstAttempt = service.findFrenchTitle(MANGA, "Shingeki no Kyojin", "Hajime Isayama");
        Optional<String> secondAttempt = service.findFrenchTitle(MANGA, "Shingeki no Kyojin", "Hajime Isayama");

        assertThat(firstAttempt).isEmpty();
        assertThat(secondAttempt).contains("L'Attaque des Titans");
        assertThat(provider.callCount).isEqualTo(2); // pas de cache hit après l'échec
    }

    @Test
    void prefers_a_series_matched_french_title_over_an_author_only_one_found_by_an_earlier_provider() {
        // Cas réel (voir historique) : Open Library, essayé en premier, ne
        // trouve "Vagabond" que par le nom de l'auteur (et remonte "Slam
        // Dunk") ; l'ordre des fournisseurs ne doit pas faire gagner cette
        // supposition sur une vraie correspondance de série du suivant.
        FakeEntityRepository repository = new FakeEntityRepository(List.of());
        FakeFrenchTitleProvider guessing = new FakeFrenchTitleProvider(Optional.of(FrenchTitleMatch.authorOnly("Slam Dunk")));
        FakeFrenchTitleProvider matching = new FakeFrenchTitleProvider(Optional.of(FrenchTitleMatch.seriesMatched("Vagabond")));
        MetadataSearchService service = new MetadataSearchService(
                List.of(), List.of(), repository, List.of(guessing, matching), List.of(), new FakeVolumeSearchCacheRepository());

        Optional<String> result = service.findFrenchTitle(MANGA, "Vagabond", "Takehiko Inoue");

        assertThat(result).contains("Vagabond");
    }

    @Test
    void drops_an_author_only_french_title_that_is_the_catalogued_title_of_another_work() {
        // Le bug d'origine : "Vagabond" (Takehiko Inoue) se pré-remplissait
        // en "Slam Dunk", son autre manga - catalogué tel quel sous un autre
        // identifiant, donc jamais une traduction française de la série
        // cherchée.
        FakeEntityRepository repository = new FakeEntityRepository(List.of());
        FakeMetadataProvider catalogue = new FakeMetadataProvider(List.of(candidate("Slam Dunk", "51")));
        FakeFrenchTitleProvider frenchTitleProvider =
                new FakeFrenchTitleProvider(Optional.of(FrenchTitleMatch.authorOnly("Slam Dunk")));
        MetadataSearchService service = new MetadataSearchService(
                List.of(catalogue), List.of(), repository, List.of(frenchTitleProvider), List.of(), new FakeVolumeSearchCacheRepository());

        Optional<String> result = service.findFrenchTitle(MANGA, "Vagabond", "Takehiko Inoue", List.of(), "656");

        assertThat(result).isEmpty();
    }

    @Test
    void keeps_an_author_only_french_title_that_no_catalogued_work_bears_exactly() {
        // "Zom 100" (Haro Aso) est publié en France sous "Bucket List of the
        // Dead" : le catalogue ne connaît que "Zom 100: Bucket List of the
        // Dead", un titre DIFFÉRENT - la vérification compare par égalité
        // exacte, jamais par inclusion, sans quoi ce vrai titre français
        // serait écarté à tort.
        FakeEntityRepository repository = new FakeEntityRepository(List.of());
        FakeMetadataProvider catalogue =
                new FakeMetadataProvider(List.of(candidate("Zom 100: Bucket List of the Dead", "122392")));
        FakeFrenchTitleProvider frenchTitleProvider =
                new FakeFrenchTitleProvider(Optional.of(FrenchTitleMatch.authorOnly("Bucket List of the Dead")));
        MetadataSearchService service = new MetadataSearchService(
                List.of(catalogue), List.of(), repository, List.of(frenchTitleProvider), List.of(), new FakeVolumeSearchCacheRepository());

        Optional<String> result = service.findFrenchTitle(MANGA, "Zom 100", "Haro Aso", List.of(), "122392");

        assertThat(result).contains("Bucket List of the Dead");
    }

    @Test
    void keeps_an_author_only_french_title_when_the_catalogued_work_is_the_queried_series_itself() {
        // Une édition française qui garde le titre d'origine : le catalogue
        // le connaît forcément, mais c'est la série cherchée elle-même, pas
        // une autre œuvre - reconnue par son titre quand l'identifiant n'est
        // pas fourni (ex: candidat issu d'un scan ISBN).
        FakeEntityRepository repository = new FakeEntityRepository(List.of());
        FakeMetadataProvider catalogue = new FakeMetadataProvider(List.of(candidate("Vagabond", "656")));
        FakeFrenchTitleProvider frenchTitleProvider =
                new FakeFrenchTitleProvider(Optional.of(FrenchTitleMatch.authorOnly("Vagabond")));
        MetadataSearchService service = new MetadataSearchService(
                List.of(catalogue), List.of(), repository, List.of(frenchTitleProvider), List.of(), new FakeVolumeSearchCacheRepository());

        Optional<String> result = service.findFrenchTitle(MANGA, "Vagabond", "Takehiko Inoue");

        assertThat(result).contains("Vagabond");
    }

    @Test
    void ignores_a_provider_that_searches_by_french_title_when_checking_an_author_only_title() {
        // "Gloutons et Dragons" (titre français de "Delicious in Dungeon")
        // est évidemment trouvé par le fournisseur qui cherche PAR titre
        // français - s'en servir pour décider "c'est une autre œuvre"
        // écarterait systématiquement les bonnes réponses.
        FakeEntityRepository repository = new FakeEntityRepository(List.of());
        FakeFrenchTitleSearchProvider frenchCatalogue =
                new FakeFrenchTitleSearchProvider(List.of(candidate("Gloutons et Dragons", "gb-1")));
        FakeFrenchTitleProvider frenchTitleProvider =
                new FakeFrenchTitleProvider(Optional.of(FrenchTitleMatch.authorOnly("Gloutons et Dragons")));
        MetadataSearchService service = new MetadataSearchService(
                List.of(frenchCatalogue), List.of(), repository, List.of(frenchTitleProvider), List.of(),
                new FakeVolumeSearchCacheRepository());

        Optional<String> result = service.findFrenchTitle(MANGA, "Delicious in Dungeon", "Ryoko Kui", List.of(), "88089");

        assertThat(result).contains("Gloutons et Dragons");
    }

    @Test
    void drops_an_author_only_title_when_the_catalogue_cannot_be_reached_to_check_it() {
        // Une supposition non corroborée vaut moins qu'un 404 : le client
        // garde alors le titre original déjà affiché, plutôt que de se voir
        // imposer le titre d'une autre série.
        FakeEntityRepository repository = new FakeEntityRepository(List.of());
        FakeFrenchTitleProvider frenchTitleProvider =
                new FakeFrenchTitleProvider(Optional.of(FrenchTitleMatch.authorOnly("Slam Dunk")));
        MetadataSearchService service = new MetadataSearchService(
                List.of(new FailingMetadataProvider()), List.of(), repository, List.of(frenchTitleProvider), List.of(),
                new FakeVolumeSearchCacheRepository());

        Optional<String> result = service.findFrenchTitle(MANGA, "Vagabond", "Takehiko Inoue");

        assertThat(result).isEmpty();
    }

    @Test
    void does_not_call_the_french_title_provider_for_an_unsupported_entity_type() {
        EntityType videoGame = new EntityType(UUID.randomUUID(), "VIDEO_GAME", "Jeu vidéo", Set.of(), Set.of());
        FakeEntityRepository repository = new FakeEntityRepository(List.of());
        FakeFrenchTitleProvider frenchTitleProvider = new FakeFrenchTitleProvider(Optional.of(FrenchTitleMatch.seriesMatched("Ne devrait jamais sortir")));
        MetadataSearchService service =
                new MetadataSearchService(List.of(), List.of(), repository, List.of(frenchTitleProvider), List.of(), new FakeVolumeSearchCacheRepository());

        Optional<String> result = service.findFrenchTitle(videoGame, "Zelda", null);

        assertThat(result).isEmpty();
        assertThat(frenchTitleProvider.callCount).isEqualTo(0);
    }

    @Test
    void searchVolumes_aggregates_results_from_every_supporting_provider() {
        FakeVolumeSearchProvider provider = new FakeVolumeSearchProvider(
                List.of(new VolumeCandidate("Kana", 1, "http://cover/1.jpg", "Death Note - Tome 1")));
        MetadataSearchService service =
                new MetadataSearchService(List.of(), List.of(), new FakeEntityRepository(List.of()), List.of(), List.of(provider), new FakeVolumeSearchCacheRepository());

        VolumeSearchResult result = service.searchVolumes(MANGA, "Death Note", "Ohba");

        assertThat(result.volumes()).hasSize(1);
        assertThat(result.volumes().get(0).edition()).isEqualTo("Kana");
        assertThat(result.quotaExceeded()).isFalse();
    }

    @Test
    void reports_quota_exceeded_when_a_provider_fails_with_no_usable_result() {
        // Cas réel qui motive VolumeSearchResult (voir historique) : un
        // quota Google Books dépassé pendant la recherche de tomes
        // ressemblait, côté client, à "aucune édition trouvée" - le
        // distinguer permet d'afficher un message adapté.
        FakeVolumeSearchProvider provider = new FakeVolumeSearchProvider(new QuotaExceededException("quota dépassé"));
        MetadataSearchService service =
                new MetadataSearchService(List.of(), List.of(), new FakeEntityRepository(List.of()), List.of(), List.of(provider), new FakeVolumeSearchCacheRepository());

        VolumeSearchResult result = service.searchVolumes(MANGA, "Death Note", "Ohba");

        assertThat(result.volumes()).isEmpty();
        assertThat(result.quotaExceeded()).isTrue();
    }

    @Test
    void does_not_lose_another_providers_results_when_one_provider_hits_its_quota() {
        FakeVolumeSearchProvider failing = new FakeVolumeSearchProvider(new QuotaExceededException("quota dépassé"));
        FakeVolumeSearchProvider succeeding = new FakeVolumeSearchProvider(
                List.of(new VolumeCandidate("Kana", 1, null, "Death Note - Tome 1")));
        MetadataSearchService service = new MetadataSearchService(
                List.of(), List.of(), new FakeEntityRepository(List.of()), List.of(), List.of(failing, succeeding), new FakeVolumeSearchCacheRepository());

        VolumeSearchResult result = service.searchVolumes(MANGA, "Death Note", "Ohba");

        assertThat(result.volumes()).hasSize(1); // le résultat de "succeeding" n'est pas perdu
        assertThat(result.quotaExceeded()).isTrue(); // mais le quota dépassé ailleurs reste signalé
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
        MetadataSearchService service =
                new MetadataSearchService(List.of(), List.of(), new FakeEntityRepository(List.of()), List.of(), List.of(provider), new FakeVolumeSearchCacheRepository());

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
        MetadataSearchService service =
                new MetadataSearchService(List.of(), List.of(), new FakeEntityRepository(List.of()), List.of(), List.of(provider), new FakeVolumeSearchCacheRepository());

        service.searchVolumes(MANGA, "Death Note", "Ohba");
        service.searchVolumes(MANGA, "Death Note", "Ohba");

        assertThat(provider.callCount).isEqualTo(2); // jamais servi par le cache
    }

    @Test
    void caches_a_successful_volume_search_so_a_later_call_does_not_hit_the_provider_again() {
        FakeVolumeSearchProvider provider = new FakeVolumeSearchProvider(
                List.of(new VolumeCandidate("Kana", 1, null, "Death Note - Tome 1")));
        MetadataSearchService service =
                new MetadataSearchService(List.of(), List.of(), new FakeEntityRepository(List.of()), List.of(), List.of(provider), new FakeVolumeSearchCacheRepository());

        service.searchVolumes(MANGA, "Death Note", "Ohba");
        service.searchVolumes(MANGA, "Death Note", "Ohba");

        assertThat(provider.callCount).isEqualTo(1);
    }

    @Test
    void a_volume_search_already_in_durable_storage_never_calls_the_provider_even_on_a_fresh_service_instance() {
        // Simule un redémarrage du backend : le cache mémoire (TtlCache) est
        // reconstruit à vide, mais le stockage durable (base de données) survit -
        // deux instances distinctes de MetadataSearchService partagent le même repo.
        FakeVolumeSearchCacheRepository durableStorage = new FakeVolumeSearchCacheRepository();
        FakeVolumeSearchProvider provider = new FakeVolumeSearchProvider(
                List.of(new VolumeCandidate("Kana", 1, null, "Death Note - Tome 1")));
        MetadataSearchService firstInstance =
                new MetadataSearchService(List.of(), List.of(), new FakeEntityRepository(List.of()), List.of(), List.of(provider), durableStorage);
        firstInstance.searchVolumes(MANGA, "Death Note", "Ohba");

        MetadataSearchService afterRestart =
                new MetadataSearchService(List.of(), List.of(), new FakeEntityRepository(List.of()), List.of(), List.of(provider), durableStorage);
        afterRestart.searchVolumes(MANGA, "Death Note", "Ohba");

        assertThat(provider.callCount).isEqualTo(1); // le "redémarrage" n'a pas relancé Google Books
    }

    @Test
    void force_refresh_bypasses_both_caches_and_overwrites_the_durable_storage() {
        FakeVolumeSearchCacheRepository durableStorage = new FakeVolumeSearchCacheRepository();
        FakeVolumeSearchProvider provider = new FakeVolumeSearchProvider(
                List.of(new VolumeCandidate("Kana", 1, null, "Death Note - Tome 1")));
        MetadataSearchService service =
                new MetadataSearchService(List.of(), List.of(), new FakeEntityRepository(List.of()), List.of(), List.of(provider), durableStorage);
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
        MetadataSearchService service =
                new MetadataSearchService(List.of(), List.of(), new FakeEntityRepository(List.of()), List.of(), List.of(provider), new FakeVolumeSearchCacheRepository());
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
        MetadataSearchService service =
                new MetadataSearchService(List.of(), List.of(), new FakeEntityRepository(List.of()), List.of(), List.of(provider), durableStorage);
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
        MetadataSearchService service =
                new MetadataSearchService(List.of(), List.of(), new FakeEntityRepository(List.of()), List.of(), List.of(provider), durableStorage);
        service.searchVolumes(MANGA, "Death Note", "Ohba");

        VolumeSearchResult result = service.searchAdditionalEditions(MANGA, "Death Note", "Ohba");

        assertThat(result.volumes()).hasSize(1); // le résultat déjà connu reste renvoyé
        assertThat(result.quotaExceeded()).isTrue();
        assertThat(durableStorage.find(MANGA.id(), "death note", "ohba")).hasValueSatisfying(
                volumes -> assertThat(volumes).hasSize(1)); // pas écrasé par un échec
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

    /** Cherche par titre FRANÇAIS (comme GoogleBooksTitleSearchProvider) -
     * doit rester hors de la vérification d'un titre "auteur seul". */
    private static final class FakeFrenchTitleSearchProvider implements MetadataProvider {
        private final List<MetadataCandidate> results;

        FakeFrenchTitleSearchProvider(List<MetadataCandidate> results) {
            this.results = results;
        }

        @Override
        public boolean supports(EntityType entityType) {
            return true;
        }

        @Override
        public boolean catalogsOriginalTitles() {
            return false;
        }

        @Override
        public List<MetadataCandidate> search(String query) {
            return results;
        }
    }

    /** Catalogue injoignable (panne réseau/quota) - voir
     * drops_an_author_only_title_when_the_catalogue_cannot_be_reached_to_check_it. */
    private static final class FailingMetadataProvider implements MetadataProvider {
        @Override
        public boolean supports(EntityType entityType) {
            return true;
        }

        @Override
        public List<MetadataCandidate> search(String query) {
            throw new IllegalStateException("catalogue injoignable");
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
        private final Optional<FrenchTitleMatch> result;
        int callCount = 0;

        FakeFrenchTitleProvider(Optional<FrenchTitleMatch> result) {
            this.result = result;
        }

        @Override
        public boolean supports(EntityType entityType) {
            return "MANGA".equals(entityType.code());
        }

        @Override
        public Optional<FrenchTitleMatch> findFrenchTitle(String query, String author, List<String> excludedTitleFragments) {
            callCount++;
            return result;
        }
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
        // MetadataSearchService selon l'action de l'utilisateur.
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
        public Optional<FrenchTitleMatch> findFrenchTitle(String query, String author, List<String> excludedTitleFragments) {
            callCount++;
            return callCount == 1 ? Optional.empty() : Optional.of(FrenchTitleMatch.seriesMatched(result));
        }
    }

    /** Simule la table volume_search_cache (V3__volume_search_cache.sql) - une
     * simple Map en mémoire suffit à vérifier que MetadataSearchService lit/écrit
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
    }
}
