package com.iozycore.manga;

import com.iozycore.core.domain.catalog.Entity;
import com.iozycore.core.domain.catalog.EntityType;
import com.iozycore.core.domain.catalog.EntityTypeFixtures;
import com.iozycore.core.metadata.QuotaExceededException;
import com.iozycore.core.testing.InMemoryEntityRepository;
import com.iozycore.core.testing.InMemoryEntityTypeRepository;
import com.iozycore.manga.domain.EditionTier;
import com.iozycore.manga.domain.MangaEdition;
import com.iozycore.manga.domain.TotalSource;
import com.iozycore.manga.metadata.RelatedSeriesService;
import com.iozycore.manga.metadata.StoredVolumeSearch;
import com.iozycore.manga.metadata.StoredVolumeSearchKey;
import com.iozycore.manga.metadata.TomeSearchService;
import com.iozycore.manga.metadata.VolumeCandidate;
import com.iozycore.manga.metadata.VolumeSearchCacheRepository;
import com.iozycore.manga.metadata.VolumeSearchProvider;
import com.iozycore.manga.testing.InMemoryMangaEditionRepository;
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
import static org.assertj.core.api.Assertions.assertThatCode;

/** The background job that fills the French volume counts: which series, what it writes, what it leaves. */
class EditionTotalBackfillTest {

    private static final Instant NOW = Instant.parse("2026-11-08T10:00:00Z");

    private final InMemoryEntityRepository entities = new InMemoryEntityRepository();
    private final InMemoryMangaEditionRepository editions = new InMemoryMangaEditionRepository();
    private final ScriptedProvider provider = new ScriptedProvider();

    private EditionTotalBackfill backfill(int seriesPerRun, VolumeSearchProvider... others) {
        List<VolumeSearchProvider> providers = new ArrayList<>();
        providers.add(provider);
        providers.addAll(List.of(others));
        return new EditionTotalBackfill(new InMemoryEntityTypeRepository(EntityTypeFixtures.MANGA), entities, editions,
                new MangaEditionLinker(editions), new TomeSearchService(providers, new FakeCache()),
                new RelatedSeriesService(List.of()), true, seriesPerRun, Duration.ZERO, Duration.ofDays(7),
                Clock.fixed(NOW, ZoneOffset.UTC));
    }

    @Test
    void creates_the_missing_edition_through_the_linker_and_fills_a_provider_total() {
        Entity pluto = serie("Pluto");
        tome(pluto, 1, "Kana");
        tome(pluto, 3, "Kana");
        pluto.setAttribute("totalVolumes", 8);
        pluto.setAttribute("seriesStatus", "FINISHED");
        entities.save(pluto);
        provider.answers.put("Pluto", candidates("Kana", 8));

        EditionTotalBackfill.Result result = backfill(10).run();

        assertThat(result).isEqualTo(new EditionTotalBackfill.Result(1, 1, false));
        MangaEdition edition = editions.findByEntityIdAndEditionName(pluto.id(), "Kana").orElseThrow();
        assertThat(edition.totalVolumes()).isEqualTo(8);
        assertThat(edition.totalSource()).isEqualTo(TotalSource.PROVIDER);
        assertThat(edition.frenchRunFinished()).isTrue();
        assertThat(edition.totalCheckedAt()).isEqualTo(NOW);
    }

    @Test
    void an_ongoing_series_gets_the_volumes_out_so_far_and_is_revisited_later() {
        Entity frieren = serie("Frieren");
        tome(frieren, 1, "Ki-oon");
        frieren.setAttribute("totalVolumes", 14);
        frieren.setAttribute("seriesStatus", "RELEASING");
        entities.save(frieren);
        provider.answers.put("Frieren", candidates("Ki-oon", 12));

        backfill(10).run();

        MangaEdition edition = editions.findByEntityIdAndEditionName(frieren.id(), "Ki-oon").orElseThrow();
        assertThat(edition.totalVolumes()).isEqualTo(12);
        assertThat(edition.frenchRunFinished()).isFalse();
        // Checked a moment ago: the next run leaves it until the week is over.
        provider.titles.clear();
        assertThat(backfill(10).run()).isEqualTo(new EditionTotalBackfill.Result(0, 0, false));
        assertThat(provider.titles).isEmpty();
    }

    @Test
    void never_touches_nor_searches_a_total_typed_by_hand() {
        Entity berserk = serie("Berserk");
        tome(berserk, 1, "Glénat");
        entities.save(berserk);
        MangaEdition typed = editions.save(MangaEdition.create(berserk.id(), "Berserk", "Glénat",
                EditionTier.STANDARD, null, 41, null, false, false, null));
        provider.answers.put("Berserk", candidates("Glénat", 42));

        EditionTotalBackfill.Result result = backfill(10).run();

        assertThat(result).isEqualTo(new EditionTotalBackfill.Result(0, 0, false));
        assertThat(provider.titles).isEmpty();
        MangaEdition after = editions.findById(typed.id()).orElseThrow();
        assertThat(after.totalVolumes()).isEqualTo(41);
        assertThat(after.totalSource()).isEqualTo(TotalSource.MANUAL);
    }

    @Test
    void a_silent_provider_changes_nothing_throws_nothing_and_sends_the_series_to_the_back() {
        Entity a = serie("A");
        tome(a, 1, "Kana");
        entities.save(a);
        Entity b = serie("B");
        tome(b, 1, "Kana");
        entities.save(b);
        provider.failAfter = 0;

        EditionTotalBackfill backfill = backfill(10);
        assertThatCode(backfill::scheduled).doesNotThrowAnyException();
        provider.titles.clear();
        EditionTotalBackfill.Result result = backfill.run();

        assertThat(result).isEqualTo(new EditionTotalBackfill.Result(1, 0, true));
        // A was tried by the first run: B goes first, so a series that keeps failing blocks no other.
        assertThat(provider.titles).containsExactly("B");
        // Not even a row or a check time: the next run tries again.
        assertThat(editions.findAll()).isEmpty();
    }

    @Test
    void a_partial_answer_writes_what_it_found_but_keeps_every_edition_due() {
        Entity monster = serie("Monster");
        tome(monster, 1, "Kana");
        tome(monster, 1, "Perfect");
        entities.save(monster);
        provider.answers.put("Monster", candidates("Kana", 18));

        EditionTotalBackfill.Result result = backfill(10, new SilentProvider()).run();

        assertThat(result).isEqualTo(new EditionTotalBackfill.Result(1, 1, false));
        MangaEdition kana = editions.findByEntityIdAndEditionName(monster.id(), "Kana").orElseThrow();
        assertThat(kana.totalVolumes()).isEqualTo(18);
        assertThat(kana.totalSource()).isEqualTo(TotalSource.PROVIDER);
        // The silent source may list more: no check time, the next run reads it again.
        assertThat(kana.totalCheckedAt()).isNull();
        // The silent source may hold the Perfect: no row, no check time.
        assertThat(editions.findByEntityIdAndEditionName(monster.id(), "Perfect")).isEmpty();
        provider.titles.clear();
        backfill(10, new SilentProvider()).run();
        assertThat(provider.titles).containsExactly("Monster");
    }

    @Test
    void never_writes_on_the_edition_of_a_homonym_series() {
        Entity first = serie("Doubt");
        tome(first, 1, "Ki-oon");
        entities.save(first);
        MangaEdition theirs = editions.save(MangaEdition.create(first.id(), "Doubt", "Ki-oon", EditionTier.STANDARD,
                null, null, null, false, false, null).withTotalChecked(NOW));
        Entity homonym = serie("Doubt");
        tome(homonym, 1, "Ki-oon");
        entities.save(homonym);
        provider.answers.put("Doubt", candidates("Ki-oon", 4));

        backfill(10).run();

        MangaEdition after = editions.findById(theirs.id()).orElseThrow();
        assertThat(after.totalVolumes()).isNull();
        assertThat(after.totalCheckedAt()).isEqualTo(NOW);
        assertThat(editions.findByEntityIdAndEditionName(homonym.id(), "Ki-oon")).isEmpty();
    }

    @Test
    void an_answer_without_the_edition_marks_it_checked_without_a_total() {
        Entity doubt = serie("Doubt");
        tome(doubt, 1, "Ki-oon");
        entities.save(doubt);
        provider.answers.put("Doubt", candidates("Pika", 4));

        EditionTotalBackfill.Result result = backfill(10).run();

        assertThat(result).isEqualTo(new EditionTotalBackfill.Result(1, 0, false));
        MangaEdition edition = editions.findByEntityIdAndEditionName(doubt.id(), "Ki-oon").orElseThrow();
        assertThat(edition.totalVolumes()).isNull();
        assertThat(edition.totalCheckedAt()).isEqualTo(NOW);
    }

    @Test
    void leaves_out_the_volumes_without_an_edition_name_and_bounds_a_run() {
        Entity unnamed = serie("Sans nom");
        tome(unnamed, 1, null);
        entities.save(unnamed);
        Entity a = serie("A");
        tome(a, 1, "Kana");
        entities.save(a);
        Entity b = serie("B");
        tome(b, 1, "Kana");
        entities.save(b);

        EditionTotalBackfill.Result result = backfill(1).run();

        assertThat(result.seriesSearched()).isEqualTo(1);
        assertThat(provider.titles).doesNotContain("Sans nom").hasSize(1);
    }

    // ------------------------------------------------------------ Factory

    private static Entity serie(String title) {
        Entity entity = Entity.create(EntityTypeFixtures.MANGA.id(), title);
        entity.setAttribute("mangaka", "Auteur de " + title);
        return entity;
    }

    private static void tome(Entity entity, int number, String edition) {
        Map<String, Object> attributes = new HashMap<>();
        attributes.put("volumeNumber", number);
        if (edition != null) {
            attributes.put("edition", edition);
        }
        entity.addVariant("Tome " + number + (edition == null ? "" : " " + edition), attributes);
    }

    private static List<VolumeCandidate> candidates(String edition, int upTo) {
        List<VolumeCandidate> list = new ArrayList<>();
        for (int number = 1; number <= upTo; number++) {
            list.add(new VolumeCandidate(edition, number, null, "Tome " + number));
        }
        return list;
    }

    /** Answers what it was told per title, records the titles asked, and can go silent from a given call. */
    private static class ScriptedProvider implements VolumeSearchProvider {
        final Map<String, List<VolumeCandidate>> answers = new HashMap<>();
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
            return answers.getOrDefault(seriesTitle, List.of());
        }
    }

    /** A source that never answers (quota, outage). */
    private static class SilentProvider implements VolumeSearchProvider {
        @Override
        public boolean supports(EntityType entityType) {
            return true;
        }

        @Override
        public List<VolumeCandidate> searchVolumes(String seriesTitle, String author, List<String> excludedTitleFragments) {
            throw new QuotaExceededException("quota dépassé");
        }
    }

    private static class FakeCache implements VolumeSearchCacheRepository {
        private final Map<String, StoredVolumeSearch> store = new HashMap<>();

        @Override
        public Optional<StoredVolumeSearch> find(UUID entityTypeId, String seriesTitle, String author) {
            return Optional.ofNullable(store.get(StoredVolumeSearch.key(seriesTitle, author)));
        }

        @Override
        public void save(UUID entityTypeId, String seriesTitle, String author, List<VolumeCandidate> volumes, int chainVersion,
                         Instant fetchedAt) {
            store.put(StoredVolumeSearch.key(seriesTitle, author),
                    new StoredVolumeSearch(seriesTitle, author, volumes, fetchedAt, chainVersion));
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
            return List.of();
        }
    }
}
