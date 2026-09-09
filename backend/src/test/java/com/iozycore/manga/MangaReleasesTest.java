package com.iozycore.manga;

import com.iozycore.core.domain.catalog.Entity;
import com.iozycore.core.domain.catalog.EntityTypeFixtures;
import com.iozycore.core.domain.catalog.Variant;
import com.iozycore.core.domain.ownership.Ownership;
import com.iozycore.core.domain.ownership.OwnershipCondition;
import com.iozycore.core.domain.wishlist.WishlistEntry;
import com.iozycore.core.insights.ReleaseContext;
import com.iozycore.core.insights.ReleaseDate;
import com.iozycore.core.insights.ReleaseEntry;
import com.iozycore.manga.domain.followededition.FollowedEdition;
import com.iozycore.manga.domain.followededition.FollowedEditionRepository;
import com.iozycore.manga.metadata.StoredVolumeSearch;
import com.iozycore.manga.metadata.StoredVolumeSearchKey;
import com.iozycore.manga.metadata.VolumeCandidate;
import com.iozycore.manga.metadata.VolumeSearchCacheRepository;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Les sorties d'un manga : les tomes datés du résultat de recherche stocké,
 * pour l'édition qui concerne la collection, avec la relation écrite.
 */
class MangaReleasesTest {

    private static final LocalDate OCTOBER_1 = LocalDate.of(2026, 10, 1);
    private static final LocalDate OCTOBER_31 = LocalDate.of(2026, 10, 31);

    private final FakeVolumeSearchCacheRepository cache = new FakeVolumeSearchCacheRepository();
    private final FakeFollowedEditionRepository followed = new FakeFollowedEditionRepository();
    private final MangaReleases releases = new MangaReleases(cache, followed);

    @Test
    void lists_the_dated_tomes_of_the_owned_edition_saying_which_ones_are_missing() {
        Entity naruto = serie("Naruto", "Kishimoto, Masashi");
        Variant tome71 = naruto.addVariant("Tome 71", Map.of("edition", "Kana", "volumeNumber", 71));
        Variant tome72 = naruto.addVariant("Tome 72", Map.of("edition", "Kana", "volumeNumber", 72));
        cache.store("naruto", "kishimoto masashi",
                tome("Kana", 71, "2026-10-02", "https://img/71.jpg"),
                tome("Kana", 72, "2026-10-14", null),
                tome("Kana", 73, "2026-11-04", null),
                tome("Hokage", 72, "2026-10-20", null),
                tome("Kana", 70, "2026", null));

        List<ReleaseEntry> entries = releases.releasesBetween(context(List.of(naruto),
                List.of(owned(naruto, tome71)), List.of()));

        assertThat(entries).extracting(ReleaseEntry::label).containsExactly("Tome 71 · Kana", "Tome 72 · Kana");
        ReleaseEntry owned = entries.get(0);
        assertThat(owned.relation()).isEqualTo(ReleaseEntry.Relation.OWNED);
        assertThat(owned.date()).isEqualTo(ReleaseDate.ofDay(LocalDate.of(2026, 10, 2)));
        assertThat(owned.coverImageUrl()).isEqualTo("https://img/71.jpg");
        assertThat(owned.volumeNumber()).isEqualTo(71);
        assertThat(owned.editionName()).isEqualTo("Kana");
        assertThat(owned.source()).isEqualTo("GOOGLE_BOOKS");
        ReleaseEntry missing = entries.get(1);
        assertThat(missing.relation()).isEqualTo(ReleaseEntry.Relation.MISSING);
        assertThat(missing.entityId()).isEqualTo(naruto.id());
        assertThat(missing.entityTypeId()).isEqualTo(EntityTypeFixtures.MANGA.id());
        // Le tome 72 n'a pas de jaquette chez la source : celle de la série sert de repli.
        assertThat(missing.coverImageUrl()).isNull();
        assertThat(tome72.id()).isNotNull();
    }

    @Test
    void follows_the_followed_edition_rather_than_the_owned_one() {
        Entity naruto = serie("Naruto", "Kishimoto, Masashi");
        Variant tome1 = naruto.addVariant("Tome 1", Map.of("edition", "Kana", "volumeNumber", 1));
        followed.save(FollowedEdition.create(naruto.id(), "Hokage"));
        cache.store("naruto", "kishimoto masashi",
                tome("Kana", 72, "2026-10-14", null),
                tome("Hokage", 20, "2026-10-20", null));

        List<ReleaseEntry> entries = releases.releasesBetween(context(List.of(naruto),
                List.of(owned(naruto, tome1)), List.of()));

        assertThat(entries).extracting(ReleaseEntry::label).containsExactly("Tome 20 · Hokage");
        assertThat(entries.get(0).relation()).isEqualTo(ReleaseEntry.Relation.MISSING);
    }

    @Test
    void a_wanted_series_shows_its_most_complete_edition_as_wanted() {
        Entity spy = serie("Spy x Family", "Endo, Tatsuya");
        cache.store("spy x family", "endo tatsuya",
                tome("Kurokawa", 14, "2026-10-08", null),
                tome("Kurokawa", 15, "2026-10", null),
                tome("Collector", 1, "2026-10-08", null));

        List<ReleaseEntry> entries = releases.releasesBetween(context(List.of(spy), List.of(),
                List.of(WishlistEntry.add(spy.id(), LocalDate.now()))));

        assertThat(entries).extracting(ReleaseEntry::label).containsExactly("Tome 14 · Kurokawa", "Tome 15 · Kurokawa");
        assertThat(entries).extracting(ReleaseEntry::relation).containsOnly(ReleaseEntry.Relation.WANTED);
        assertThat(entries.get(1).date()).isEqualTo(ReleaseDate.ofMonth(YearMonth.of(2026, 10)));
    }

    @Test
    void a_wanted_tome_of_an_owned_series_is_wanted_not_missing() {
        Entity naruto = serie("Naruto", "Kishimoto, Masashi");
        Variant tome71 = naruto.addVariant("Tome 71", Map.of("edition", "Kana", "volumeNumber", 71));
        Variant tome72 = naruto.addVariant("Tome 72", Map.of("edition", "Kana", "volumeNumber", "72"));
        cache.store("naruto", "kishimoto masashi",
                tome("Kana", 72, "2026-10-14", null),
                tome("Kana", 73, "2026-10-21", null));

        List<ReleaseEntry> entries = releases.releasesBetween(context(List.of(naruto),
                List.of(owned(naruto, tome71)),
                List.of(WishlistEntry.addVariant(naruto.id(), tome72.id(), LocalDate.now()))));

        assertThat(entries).extracting(ReleaseEntry::relation)
                .containsExactly(ReleaseEntry.Relation.WANTED, ReleaseEntry.Relation.MISSING);
    }

    @Test
    void says_nothing_for_a_series_without_stored_result_or_without_author() {
        Entity unknown = serie("Inconnue", "Auteur, Quelconque");
        Entity noAuthor = serie("Sans auteur", null);
        cache.store("sans auteur", "", tome("Kana", 1, "2026-10-14", null));

        List<ReleaseEntry> entries = releases.releasesBetween(context(List.of(unknown, noAuthor),
                List.of(owned(unknown, null), owned(noAuthor, null)), List.of()));

        // « Sans auteur » a bien une ligne stockée sous auteur vide : elle est lue telle quelle.
        assertThat(entries).extracting(ReleaseEntry::entityTitle).containsExactly("Sans auteur");
    }

    @Test
    void reads_the_stored_results_once_whatever_the_number_of_series() {
        List<Entity> series = new ArrayList<>();
        List<Ownership> ownerships = new ArrayList<>();
        for (int i = 0; i < 30; i++) {
            Entity serie = serie("Série " + i, "Auteur " + i);
            series.add(serie);
            ownerships.add(owned(serie, null));
            cache.store("serie " + i, "auteur " + i, tome("Kana", 1, "2026-10-14", null));
        }

        List<ReleaseEntry> entries = releases.releasesBetween(context(series, ownerships, List.of()));

        assertThat(entries).hasSize(30);
        assertThat(cache.bulkReads).isEqualTo(1);
        assertThat(followed.reads).isEqualTo(1);
    }

    @Test
    void covers_manga_only() {
        assertThat(releases.supports(EntityTypeFixtures.MANGA)).isTrue();
        assertThat(releases.supports(EntityTypeFixtures.VIDEO_GAME)).isFalse();
    }

    // ------------------------------------------------------------ Fabrique

    private static ReleaseContext context(List<Entity> series, List<Ownership> ownerships, List<WishlistEntry> wishlist) {
        return new ReleaseContext(EntityTypeFixtures.MANGA, OCTOBER_1, OCTOBER_31, series, ownerships, wishlist);
    }

    private static Entity serie(String title, String mangaka) {
        Entity entity = Entity.create(EntityTypeFixtures.MANGA.id(), title);
        if (mangaka != null) {
            entity.setAttribute("mangaka", mangaka);
        }
        return entity;
    }

    private static Ownership owned(Entity serie, Variant tome) {
        return Ownership.acquire(serie.id(), tome == null ? null : tome.id(), OwnershipCondition.NEW, LocalDate.now(), null);
    }

    private static VolumeCandidate tome(String edition, int number, String releaseDate, String imageUrl) {
        return new VolumeCandidate(edition, number, imageUrl, edition + " " + number, null, null, releaseDate);
    }

    private static class FakeVolumeSearchCacheRepository implements VolumeSearchCacheRepository {
        private final Map<String, StoredVolumeSearch> store = new HashMap<>();
        int bulkReads;

        void store(String normalizedTitle, String normalizedAuthor, VolumeCandidate... volumes) {
            store.put(StoredVolumeSearch.key(normalizedTitle, normalizedAuthor),
                    new StoredVolumeSearch(normalizedTitle, normalizedAuthor, List.of(volumes), Instant.now()));
        }

        @Override
        public Optional<List<VolumeCandidate>> find(UUID entityTypeId, String seriesTitle, String author) {
            return Optional.ofNullable(store.get(StoredVolumeSearch.key(seriesTitle, author))).map(StoredVolumeSearch::volumes);
        }

        @Override
        public void save(UUID entityTypeId, String seriesTitle, String author, List<VolumeCandidate> volumes) {
            store(seriesTitle, author, volumes.toArray(VolumeCandidate[]::new));
        }

        @Override
        public void delete(UUID entityTypeId, String seriesTitle, String author) {
            store.remove(StoredVolumeSearch.key(seriesTitle, author));
        }

        @Override
        public List<StoredVolumeSearch> findAllByEntityTypeIdAndSeriesTitleIn(UUID entityTypeId, Collection<String> seriesTitles) {
            bulkReads++;
            return store.values().stream().filter(stored -> seriesTitles.contains(stored.seriesTitle())).toList();
        }

        @Override
        public List<StoredVolumeSearchKey> findKeysByEntityTypeId(UUID entityTypeId) {
            return store.values().stream()
                    .map(stored -> new StoredVolumeSearchKey(stored.seriesTitle(), stored.author(), stored.fetchedAt()))
                    .toList();
        }
    }

    private static class FakeFollowedEditionRepository implements FollowedEditionRepository {
        private final Map<UUID, FollowedEdition> store = new HashMap<>();
        int reads;

        @Override
        public FollowedEdition save(FollowedEdition followedEdition) {
            store.put(followedEdition.entityId(), followedEdition);
            return followedEdition;
        }

        @Override
        public Optional<FollowedEdition> findByEntityId(UUID entityId) {
            return Optional.ofNullable(store.get(entityId));
        }

        @Override
        public List<FollowedEdition> findByEntityIdIn(List<UUID> entityIds) {
            reads++;
            return entityIds.stream().map(store::get).filter(java.util.Objects::nonNull).toList();
        }

        @Override
        public void deleteByEntityId(UUID entityId) {
            store.remove(entityId);
        }
    }
}
