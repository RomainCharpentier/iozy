package com.iozycore.manga;

import com.iozycore.core.domain.catalog.Entity;
import com.iozycore.core.domain.catalog.EntityType;
import com.iozycore.core.domain.catalog.EntityTypeFixtures;
import com.iozycore.core.domain.catalog.Variant;
import com.iozycore.core.metadata.CoverImageCheck;
import com.iozycore.core.testing.InMemoryEntityRepository;
import com.iozycore.core.testing.InMemoryEntityTypeRepository;
import com.iozycore.core.metadata.QuotaExceededException;
import com.iozycore.manga.metadata.RelatedSeriesService;
import com.iozycore.manga.metadata.StoredVolumeSearch;
import com.iozycore.manga.metadata.StoredVolumeSearchKey;
import com.iozycore.manga.metadata.TomeSearchService;
import com.iozycore.manga.metadata.VolumeCandidate;
import com.iozycore.manga.metadata.VolumeSearchCacheRepository;
import com.iozycore.manga.metadata.VolumeSearchProvider;
import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The automatic cover backfill: which volumes, which candidate, what a
 * refused cover and a silent provider leave behind.
 */
class MangaCoverBackfillTest {

    private final InMemoryEntityRepository entities = new InMemoryEntityRepository();
    private final ScriptedProvider provider = new ScriptedProvider();
    private final TomeSearchService tomeSearchService = new TomeSearchService(List.of(provider), new FakeCache());
    private final List<CoverImageCheck> checks = new ArrayList<>();

    private MangaCoverBackfill backfill(int seriesPerRun) {
        return new MangaCoverBackfill(new InMemoryEntityTypeRepository(EntityTypeFixtures.MANGA), entities, tomeSearchService,
                new RelatedSeriesService(List.of()), checks, true, seriesPerRun, Duration.ZERO);
    }

    @Test
    void gives_each_volume_without_a_cover_the_candidate_of_its_number_and_edition() {
        Entity berserk = serie("Berserk", "Kentarou Miura");
        Variant t1 = tome(berserk, 1, "Glénat", null);
        Variant t2 = tome(berserk, 2, "Glénat", "https://deja.la/t2.jpg");
        Variant t3 = tome(berserk, 3, "Glénat", null);
        Variant t9 = tome(berserk, 9, "Glénat", null);
        entities.save(berserk);
        provider.answers.put("Berserk", List.of(
                candidate("glénat", 1, "https://bnf/t1.jpg"),
                candidate("Deluxe", 1, "https://bnf/deluxe-1.jpg"),
                candidate("Deluxe", 3, "https://bnf/deluxe-3.jpg"),
                candidate("Glénat", 2, "https://bnf/t2-autre.jpg"),
                candidate("Glénat", 9, null)));

        MangaCoverBackfill.Result result = backfill(10).run();

        assertThat(result).isEqualTo(new MangaCoverBackfill.Result(1, 2, false));
        Entity saved = entities.findById(berserk.id()).orElseThrow();
        // Same number and same edition, whatever the case.
        assertThat(cover(saved, t1)).isEqualTo("https://bnf/t1.jpg");
        // A volume that already has a cover is never touched.
        assertThat(cover(saved, t2)).isEqualTo("https://deja.la/t2.jpg");
        // No candidate of the same edition: the first one of the number with a cover.
        assertThat(cover(saved, t3)).isEqualTo("https://bnf/deluxe-3.jpg");
        // A candidate without a cover gives nothing.
        assertThat(cover(saved, t9)).isNull();
    }

    @Test
    void skips_the_series_that_miss_nothing_and_a_cover_a_check_refuses() {
        Entity complete = serie("Complète", "Auteur");
        tome(complete, 1, "Kana", "https://ok/1.jpg");
        entities.save(complete);
        Entity pluto = serie("Pluto", "Naoki Urasawa");
        Variant t1 = tome(pluto, 1, "Kana", null);
        entities.save(pluto);
        provider.answers.put("Pluto", List.of(candidate("Kana", 1, "https://morte/1.jpg")));
        checks.add(url -> !url.contains("morte"));

        MangaCoverBackfill.Result result = backfill(10).run();

        assertThat(result).isEqualTo(new MangaCoverBackfill.Result(1, 0, false));
        assertThat(provider.titles).containsExactly("Pluto");
        assertThat(cover(entities.findById(pluto.id()).orElseThrow(), t1)).isNull();
    }

    @Test
    void stops_at_the_first_silent_provider_after_keeping_what_it_got_and_bounds_a_run() {
        Entity a = serie("A", "Auteur A");
        Variant a1 = tome(a, 1, "Kana", null);
        entities.save(a);
        Entity b = serie("B", "Auteur B");
        tome(b, 1, "Kana", null);
        entities.save(b);
        Entity c = serie("C", "Auteur C");
        tome(c, 1, "Kana", null);
        entities.save(c);
        provider.answers.put("A", List.of(candidate("Kana", 1, "https://bnf/a1.jpg")));
        provider.failAfter = 1;

        MangaCoverBackfill.Result result = backfill(10).run();

        assertThat(result).isEqualTo(new MangaCoverBackfill.Result(2, 1, true));
        assertThat(provider.titles).containsExactly("A", "B");
        assertThat(cover(entities.findById(a.id()).orElseThrow(), a1)).isEqualTo("https://bnf/a1.jpg");

        provider.titles.clear();
        provider.failAfter = null;
        assertThat(backfill(1).run()).isEqualTo(new MangaCoverBackfill.Result(1, 0, false));
        assertThat(provider.titles).containsExactly("B");
    }

    @Test
    void goes_on_while_a_silent_provider_does_not_stop_the_answers() {
        // Google Books at its quota, the BnF answering: the usual state of an instance.
        ScriptedProvider bnf = new ScriptedProvider();
        bnf.answers.put("A", List.of(candidate("Kana", 1, "https://bnf/a1.jpg")));
        // An old printing: the BnF knows the volume but has no image for it.
        bnf.answers.put("B", List.of(candidate("Kana", 1, null)));
        bnf.answers.put("C", List.of(candidate("Kana", 1, "https://bnf/c1.jpg")));
        ScriptedProvider google = new ScriptedProvider();
        google.failAfter = 0;
        TomeSearchService service = new TomeSearchService(List.of(bnf, google), new FakeCache());
        Entity a = serie("A", "Auteur A");
        Variant a1 = tome(a, 1, "Kana", null);
        entities.save(a);
        Entity b = serie("B", "Auteur B");
        tome(b, 1, "Kana", null);
        entities.save(b);
        Entity c = serie("C", "Auteur C");
        Variant c1 = tome(c, 1, "Kana", null);
        entities.save(c);
        Entity d = serie("D", "Auteur D");
        tome(d, 1, "Kana", null);
        entities.save(d);
        MangaCoverBackfill backfill = new MangaCoverBackfill(new InMemoryEntityTypeRepository(EntityTypeFixtures.MANGA), entities,
                service, new RelatedSeriesService(List.of()), checks, true, 10, Duration.ZERO);

        MangaCoverBackfill.Result result = backfill.run();

        // A got its cover, B an answer without one (not a silence), C its cover;
        // D got nothing at all while a source was silent: the run stops there.
        assertThat(result).isEqualTo(new MangaCoverBackfill.Result(4, 2, true));
        assertThat(bnf.titles).containsExactly("A", "B", "C", "D");
        assertThat(cover(entities.findById(a.id()).orElseThrow(), a1)).isEqualTo("https://bnf/a1.jpg");
        assertThat(cover(entities.findById(c.id()).orElseThrow(), c1)).isEqualTo("https://bnf/c1.jpg");
    }

    @Test
    void does_nothing_on_an_instance_without_the_manga_category() {
        MangaCoverBackfill backfill = new MangaCoverBackfill(new InMemoryEntityTypeRepository(), entities, tomeSearchService,
                new RelatedSeriesService(List.of()), checks, true, 10, Duration.ZERO);
        assertThat(backfill.run()).isEqualTo(new MangaCoverBackfill.Result(0, 0, false));
    }

    // ------------------------------------------------------------ Factory

    private static Entity serie(String title, String mangaka) {
        Entity entity = Entity.create(EntityTypeFixtures.MANGA.id(), title);
        entity.setAttribute("mangaka", mangaka);
        return entity;
    }

    private static Variant tome(Entity entity, int number, String edition, String cover) {
        Map<String, Object> attributes = new HashMap<>();
        attributes.put("volumeNumber", number);
        attributes.put("edition", edition);
        if (cover != null) {
            attributes.put("coverImageUrl", cover);
        }
        return entity.addVariant("Tome " + number, attributes);
    }

    private static VolumeCandidate candidate(String edition, int number, String imageUrl) {
        return new VolumeCandidate(edition, number, imageUrl, "Titre " + number);
    }

    private static String cover(Entity entity, Variant variant) {
        return entity.variants().stream().filter(v -> v.id().equals(variant.id())).findFirst()
                .map(v -> (String) v.attributes().get("coverImageUrl")).orElse(null);
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

    private static class FakeCache implements VolumeSearchCacheRepository {
        private final Map<String, StoredVolumeSearch> store = new HashMap<>();

        @Override
        public Optional<StoredVolumeSearch> find(UUID entityTypeId, String seriesTitle, String author) {
            return Optional.ofNullable(store.get(StoredVolumeSearch.key(seriesTitle, author)));
        }

        @Override
        public void save(UUID entityTypeId, String seriesTitle, String author, List<VolumeCandidate> volumes, int chainVersion) {
            store.put(StoredVolumeSearch.key(seriesTitle, author),
                    new StoredVolumeSearch(seriesTitle, author, volumes, java.time.Instant.now(), chainVersion));
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
