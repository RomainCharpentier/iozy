package com.iozycore.manga;

import com.iozycore.core.domain.catalog.Entity;
import com.iozycore.core.domain.catalog.EntityRepository;
import com.iozycore.core.domain.catalog.EntityType;
import com.iozycore.core.domain.catalog.EntityTypeFixtures;
import com.iozycore.core.domain.catalog.EntityTypeRepository;
import com.iozycore.core.insights.ReleaseRefreshSource;
import com.iozycore.core.metadata.QuotaExceededException;
import com.iozycore.manga.metadata.RelatedSeriesService;
import com.iozycore.manga.metadata.StoredVolumeSearch;
import com.iozycore.manga.metadata.StoredVolumeSearchKey;
import com.iozycore.manga.metadata.TomeSearchService;
import com.iozycore.manga.metadata.VolumeCandidate;
import com.iozycore.manga.metadata.VolumeSearchCacheRepository;
import com.iozycore.manga.metadata.VolumeSearchProvider;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The nightly re-read of ongoing series: which ones, in what order,
 * how many, and what an outage leaves behind.
 */
class MangaReleaseRefreshTest {

    private static final Instant TONIGHT = Instant.parse("2026-09-10T02:30:00Z");

    private final InMemoryEntityRepository entities = new InMemoryEntityRepository();
    private final FakeVolumeSearchCacheRepository cache = new FakeVolumeSearchCacheRepository();
    private final CountingProvider provider = new CountingProvider();
    private final TomeSearchService tomeSearchService = new TomeSearchService(List.of(provider), cache);

    private MangaReleaseRefresh refresh(int seriesPerRun) {
        return new MangaReleaseRefresh(new InMemoryEntityTypeRepository(), entities, cache, tomeSearchService,
                new RelatedSeriesService(List.of()), seriesPerRun, Duration.ofDays(7), Clock.fixed(TONIGHT, ZoneOffset.UTC));
    }

    @Test
    void rereads_only_ongoing_series_with_an_author_never_read_first_then_the_stalest() {
        serie("Terminée", "Auteur A", "FINISHED");
        serie("Sans auteur", null, "RELEASING");
        serie("Jamais lue", "Auteur B", "Publishing");
        serie("Fraîche", "Auteur C", "RELEASING");
        cache.store("fraiche", "auteur c", TONIGHT.minus(Duration.ofDays(2)));
        serie("Ancienne", "Auteur D", "currently_publishing");
        cache.store("ancienne", "auteur d", TONIGHT.minus(Duration.ofDays(30)));
        serie("Moins ancienne", "Auteur E", "RELEASING");
        cache.store("moins ancienne", "auteur e", TONIGHT.minus(Duration.ofDays(10)));

        ReleaseRefreshSource.Result summary = refresh(10).refresh();

        assertThat(summary).isEqualTo(new ReleaseRefreshSource.Result(3, 3, false));
        assertThat(provider.titles).containsExactly("Jamais lue", "Ancienne", "Moins ancienne");
        assertThat(cache.fetchedAt("jamais lue", "auteur b")).contains(Instant.now().getEpochSecond() / 100);
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
    void stops_at_the_first_silent_provider_and_leaves_the_stored_result_untouched() {
        serie("Ancienne", "Auteur A", "RELEASING");
        cache.store("ancienne", "auteur a", TONIGHT.minus(Duration.ofDays(20)),
                new VolumeCandidate("Kana", 1, null, "Ancienne 1"));
        serie("Jamais lue", "Auteur B", "RELEASING");
        // The first re-read ("Jamais lue", never read so first in line) succeeds; the second hits an exhausted quota.
        provider.failAfter = 1;

        ReleaseRefreshSource.Result summary = refresh(10).refresh();

        assertThat(summary).isEqualTo(new ReleaseRefreshSource.Result(2, 1, true));
        assertThat(provider.titles).containsExactly("Jamais lue", "Ancienne");
        // "Ancienne" keeps its result from twenty days ago: an outage erases nothing.
        assertThat(cache.find(EntityTypeFixtures.MANGA.id(), "ancienne", "auteur a")).isPresent()
                .get().satisfies(volumes -> assertThat(volumes).extracting(VolumeCandidate::title).containsExactly("Ancienne 1"));
        assertThat(cache.find(EntityTypeFixtures.MANGA.id(), "jamais lue", "auteur b")).isPresent();
    }

    @Test
    void does_nothing_on_an_instance_without_the_manga_category() {
        MangaReleaseRefresh refresh = new MangaReleaseRefresh(new InMemoryEntityTypeRepository(false), entities, cache,
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
        entity.setAttribute("seriesStatus", status);
        entities.save(entity);
    }

    /** Returns one volume per series, and records the requested titles in order; can go silent from a given call. */
    private static class CountingProvider implements VolumeSearchProvider {
        final List<String> titles = new ArrayList<>();
        Integer failAfter;

        @Override
        public boolean supports(EntityType entityType) {
            return "MANGA".equals(entityType.code());
        }

        @Override
        public List<VolumeCandidate> searchVolumes(String seriesTitle, String author, List<String> excludedTitleFragments) {
            titles.add(seriesTitle);
            if (failAfter != null && titles.size() > failAfter) {
                throw new QuotaExceededException("quota dépassé");
            }
            return List.of(new VolumeCandidate("Kana", 1, null, seriesTitle + " 1", null, null, "2026-10-14"));
        }
    }

    private static class InMemoryEntityTypeRepository implements EntityTypeRepository {
        private final Map<UUID, EntityType> store = new HashMap<>();

        InMemoryEntityTypeRepository() {
            this(true);
        }

        InMemoryEntityTypeRepository(boolean withManga) {
            if (withManga) {
                store.put(EntityTypeFixtures.MANGA.id(), EntityTypeFixtures.MANGA);
            }
        }

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
            return new ArrayList<>(store.values());
        }

        @Override
        public void deleteById(UUID id) {
            store.remove(id);
        }
    }

    private static class InMemoryEntityRepository implements EntityRepository {
        private final Map<UUID, Entity> store = new java.util.LinkedHashMap<>();

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

    private static class FakeVolumeSearchCacheRepository implements VolumeSearchCacheRepository {
        private final Map<String, StoredVolumeSearch> store = new HashMap<>();

        void store(String title, String author, Instant fetchedAt, VolumeCandidate... volumes) {
            store.put(StoredVolumeSearch.key(title, author), new StoredVolumeSearch(title, author, List.of(volumes), fetchedAt));
        }

        /** The hundreds of seconds of the stored instant - enough to say "now" without freezing the clock of save(). */
        Optional<Long> fetchedAt(String title, String author) {
            return Optional.ofNullable(store.get(StoredVolumeSearch.key(title, author)))
                    .map(stored -> stored.fetchedAt().getEpochSecond() / 100);
        }

        @Override
        public Optional<List<VolumeCandidate>> find(UUID entityTypeId, String seriesTitle, String author) {
            return Optional.ofNullable(store.get(StoredVolumeSearch.key(seriesTitle, author))).map(StoredVolumeSearch::volumes);
        }

        @Override
        public void save(UUID entityTypeId, String seriesTitle, String author, List<VolumeCandidate> volumes) {
            store.put(StoredVolumeSearch.key(seriesTitle, author),
                    new StoredVolumeSearch(seriesTitle, author, volumes, Instant.now()));
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
