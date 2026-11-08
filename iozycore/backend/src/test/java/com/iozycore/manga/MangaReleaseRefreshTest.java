package com.iozycore.manga;

import com.iozycore.core.domain.catalog.Entity;
import com.iozycore.core.domain.catalog.EntityType;
import com.iozycore.core.domain.catalog.EntityTypeFixtures;
import com.iozycore.core.application.insights.ReleaseRefreshSource;
import com.iozycore.core.metadata.QuotaExceededException;
import com.iozycore.core.metadata.SourceUnavailableException;
import com.iozycore.manga.metadata.RelatedSeriesService;
import com.iozycore.manga.metadata.StoredVolumeSearch;
import com.iozycore.manga.metadata.StoredVolumeSearchKey;
import com.iozycore.manga.metadata.TomeSearchService;
import com.iozycore.manga.metadata.VolumeCandidate;
import com.iozycore.manga.metadata.VolumeSearchCacheRepository;
import com.iozycore.manga.metadata.VolumeSearchProvider;
import org.junit.jupiter.api.Test;
import com.iozycore.core.testing.InMemoryEntityRepository;
import com.iozycore.core.testing.InMemoryEntityTypeRepository;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The nightly re-read of the series that can still announce a volume: which ones,
 * in what order, how many, and what an outage leaves behind.
 */
class MangaReleaseRefreshTest {

    private static final Instant TONIGHT = Instant.parse("2026-09-10T02:30:00Z");

    private final InMemoryEntityRepository entities = new InMemoryEntityRepository();
    private final FakeVolumeSearchCacheRepository cache = new FakeVolumeSearchCacheRepository();
    private final CountingProvider provider = new CountingProvider();
    private final TomeSearchService tomeSearchService = new TomeSearchService(List.of(provider), cache);

    private MangaReleaseRefresh refresh(int seriesPerRun) {
        return refresh(tomeSearchService, seriesPerRun);
    }

    private MangaReleaseRefresh refresh(TomeSearchService service, int seriesPerRun) {
        return new MangaReleaseRefresh(new InMemoryEntityTypeRepository(EntityTypeFixtures.MANGA), entities, cache, service,
                new RelatedSeriesService(List.of()), seriesPerRun, Duration.ofDays(7), Clock.fixed(TONIGHT, ZoneOffset.UTC));
    }

    @Test
    void rereads_series_that_can_still_announce_a_volume_never_read_first_then_the_stalest() {
        serie("Terminée", "Auteur A", "FINISHED");
        serie("Arrêtée", "Auteur F", "discontinued");
        serie("Statut inconnu", "Auteur G", null);
        serie("Jamais lue", "Auteur B", "Publishing");
        serie("En pause", "Auteur H", "on_hiatus");
        serie("Fraîche", "Auteur C", "RELEASING");
        cache.store("fraiche", "auteur c", TONIGHT.minus(Duration.ofDays(2)));
        serie("Ancienne", "Auteur D", "currently_publishing");
        cache.store("ancienne", "auteur d", TONIGHT.minus(Duration.ofDays(30)));
        serie("Moins ancienne", "Auteur E", "RELEASING");
        cache.store("moins ancienne", "auteur e", TONIGHT.minus(Duration.ofDays(10)));

        ReleaseRefreshSource.Result summary = refresh(10).refresh();

        assertThat(summary).isEqualTo(new ReleaseRefreshSource.Result(4, 4, false));
        assertThat(provider.titles).containsExactly("Jamais lue", "En pause", "Ancienne", "Moins ancienne");
        assertThat(cache.fetchedAt("jamais lue", "auteur b")).contains(Instant.now().getEpochSecond() / 100);
    }

    @Test
    void an_ongoing_series_without_author_is_searched_by_title_and_stored_for_the_calendar() {
        serie("Sans auteur", null, "RELEASING");

        ReleaseRefreshSource.Result summary = refresh(10).refresh();

        assertThat(summary).isEqualTo(new ReleaseRefreshSource.Result(1, 1, false));
        assertThat(provider.titles).containsExactly("Sans auteur");
        assertThat(cache.find(EntityTypeFixtures.MANGA.id(), "sans auteur", "")).isPresent()
                .get().satisfies(stored -> assertThat(stored.volumes()).extracting(VolumeCandidate::title)
                        .containsExactly("Sans auteur 1"));
        // The next night it is not searched again: the stored row keeps it fresh for a week.
        provider.titles.clear();
        assertThat(refresh(10).refresh()).isEqualTo(new ReleaseRefreshSource.Result(0, 0, false));
        assertThat(provider.titles).isEmpty();
    }

    @Test
    void the_detail_page_never_serves_a_row_stored_without_author() {
        serie("Sans auteur", null, "RELEASING");
        refresh(10).refresh();
        provider.titles.clear();

        // Batch 126: a title alone may be a homonym; the detail page asks the providers again.
        tomeSearchService.searchVolumes(EntityTypeFixtures.MANGA, "Sans auteur", "", false, List.of());

        assertThat(provider.titles).containsExactly("Sans auteur");
    }

    @Test
    void reads_at_most_the_configured_number_of_series_per_night() {
        for (int i = 0; i < 5; i++) {
            serie("Série " + i, "Auteur " + i, "RELEASING");
        }

        ReleaseRefreshSource.Result summary = refresh(2).refresh();

        assertThat(summary.stale()).isEqualTo(5);
        assertThat(summary.refreshed()).isEqualTo(2);
        assertThat(provider.titles).hasSize(2);
    }

    @Test
    void a_silent_series_does_not_end_the_pass_and_leaves_its_stored_result_untouched() {
        serie("Jamais lue", "Auteur B", "RELEASING");
        serie("Ancienne", "Auteur A", "RELEASING");
        cache.store("ancienne", "auteur a", TONIGHT.minus(Duration.ofDays(20)),
                new VolumeCandidate("Kana", 1, null, "Ancienne 1"));
        serie("Encore plus ancienne", "Auteur C", "RELEASING");
        cache.store("encore plus ancienne", "auteur c", TONIGHT.minus(Duration.ofDays(10)));
        provider.silentFor.add("Jamais lue");

        ReleaseRefreshSource.Result summary = refresh(10).refresh();

        // "Jamais lue" is silent, the next two still answer.
        assertThat(summary).isEqualTo(new ReleaseRefreshSource.Result(3, 2, true));
        assertThat(provider.titles).containsExactly("Jamais lue", "Ancienne", "Encore plus ancienne");
        assertThat(cache.find(EntityTypeFixtures.MANGA.id(), "jamais lue", "auteur b")).isEmpty();
    }

    @Test
    void stops_after_three_silent_series_in_a_row_to_spare_the_quota() {
        for (int i = 0; i < 6; i++) {
            serie("Série " + i, "Auteur " + i, "RELEASING");
        }
        provider.failAfter = 0;

        ReleaseRefreshSource.Result summary = refresh(10).refresh();

        assertThat(summary).isEqualTo(new ReleaseRefreshSource.Result(6, 0, true));
        assertThat(provider.titles).hasSize(3);
    }

    @Test
    void when_one_provider_is_silent_the_other_ones_volumes_are_added_to_the_stored_result() {
        serie("Ancienne", "Auteur A", "RELEASING");
        cache.store("ancienne", "auteur a", TONIGHT.minus(Duration.ofDays(20)),
                new VolumeCandidate("Kana", 1, null, "Ancienne 1"));
        // The BnF is blocked; Google Books answers with a newly announced volume.
        VolumeSearchProvider blocked = new VolumeSearchProvider() {
            @Override
            public boolean supports(EntityType entityType) {
                return true;
            }

            @Override
            public List<VolumeCandidate> searchVolumes(String seriesTitle, String author, List<String> excluded) {
                throw new SourceUnavailableException("handshake");
            }
        };
        VolumeSearchProvider answering = new VolumeSearchProvider() {
            @Override
            public boolean supports(EntityType entityType) {
                return true;
            }

            @Override
            public List<VolumeCandidate> searchVolumes(String seriesTitle, String author, List<String> excluded) {
                return List.of(new VolumeCandidate("Kana", 2, null, "Ancienne 2", null, null, "2026-10-14"));
            }
        };
        TomeSearchService partial = new TomeSearchService(List.of(blocked, answering), cache);

        ReleaseRefreshSource.Result summary = refresh(partial, 10).refresh();

        assertThat(summary).isEqualTo(new ReleaseRefreshSource.Result(1, 1, true));
        assertThat(cache.find(EntityTypeFixtures.MANGA.id(), "ancienne", "auteur a")).isPresent()
                .get().satisfies(stored -> assertThat(stored.volumes()).extracting(VolumeCandidate::title)
                        .containsExactlyInAnyOrder("Ancienne 1", "Ancienne 2"));
    }

    @Test
    void does_nothing_on_an_instance_without_the_manga_category() {
        MangaReleaseRefresh refresh = new MangaReleaseRefresh(new InMemoryEntityTypeRepository(), entities, cache,
                tomeSearchService, new RelatedSeriesService(List.of()), 10, Duration.ofDays(7),
                Clock.fixed(TONIGHT, ZoneOffset.UTC));

        assertThat(refresh.refresh()).isEqualTo(new ReleaseRefreshSource.Result(0, 0, false));
    }

    // ------------------------------------------------------------ Factory

    private void serie(String title, String mangaka, String status) {
        Entity entity = Entity.create(EntityTypeFixtures.MANGA.id(), title);
        if (mangaka != null) {
            entity.setAttribute("mangaka", mangaka);
        }
        if (status != null) {
            entity.setAttribute("seriesStatus", status);
        }
        entities.save(entity);
    }

    /** Returns one volume per series, and records the requested titles in order; can go silent. */
    private static class CountingProvider implements VolumeSearchProvider {
        final List<String> titles = new ArrayList<>();
        final Set<String> silentFor = new HashSet<>();
        Integer failAfter;

        @Override
        public boolean supports(EntityType entityType) {
            return "MANGA".equals(entityType.code());
        }

        @Override
        public List<VolumeCandidate> searchVolumes(String seriesTitle, String author, List<String> excludedTitleFragments) {
            titles.add(seriesTitle);
            if (silentFor.contains(seriesTitle) || (failAfter != null && titles.size() > failAfter)) {
                throw new QuotaExceededException("quota dépassé");
            }
            return List.of(new VolumeCandidate("Kana", 1, null, seriesTitle + " 1", null, null, "2026-10-14"));
        }
    }

    private static class FakeVolumeSearchCacheRepository implements VolumeSearchCacheRepository {
        private final Map<String, StoredVolumeSearch> store = new HashMap<>();

        void store(String title, String author, Instant fetchedAt, VolumeCandidate... volumes) {
            store.put(StoredVolumeSearch.key(title, author), new StoredVolumeSearch(title, author, List.of(volumes), fetchedAt, 1));
        }

        /** The hundreds of seconds of the stored instant - enough to say "now" without freezing the clock of save(). */
        Optional<Long> fetchedAt(String title, String author) {
            return Optional.ofNullable(store.get(StoredVolumeSearch.key(title, author)))
                    .map(stored -> stored.fetchedAt().getEpochSecond() / 100);
        }

        @Override
        public Optional<StoredVolumeSearch> find(UUID entityTypeId, String seriesTitle, String author) {
            return Optional.ofNullable(store.get(StoredVolumeSearch.key(seriesTitle, author)));
        }

        @Override
        public void save(UUID entityTypeId, String seriesTitle, String author, List<VolumeCandidate> volumes, int chainVersion) {
            store.put(StoredVolumeSearch.key(seriesTitle, author),
                    new StoredVolumeSearch(seriesTitle, author, volumes, Instant.now(), chainVersion));
        }

        @Override
        public void delete(UUID entityTypeId, String seriesTitle, String author) {
            store.remove(StoredVolumeSearch.key(seriesTitle, author));
        }

        @Override
        public List<StoredVolumeSearch> findAllByEntityTypeIdAndSeriesTitleIn(UUID entityTypeId, Collection<String> seriesTitles) {
            return store.values().stream().filter(stored -> seriesTitles.contains(stored.seriesTitle())).toList();
        }

        @Override
        public List<StoredVolumeSearchKey> findKeysByEntityTypeId(UUID entityTypeId) {
            return store.values().stream()
                    .map(stored -> new StoredVolumeSearchKey(stored.seriesTitle(), stored.author(), stored.fetchedAt()))
                    .toList();
        }
    }
}
