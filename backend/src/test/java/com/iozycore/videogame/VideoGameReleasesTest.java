package com.iozycore.videogame;

import com.iozycore.core.domain.catalog.Entity;
import com.iozycore.core.domain.catalog.EntityTypeFixtures;
import com.iozycore.core.domain.ownership.Ownership;
import com.iozycore.core.domain.ownership.OwnershipCondition;
import com.iozycore.core.domain.wishlist.WishlistEntry;
import com.iozycore.core.insights.ReleaseContext;
import com.iozycore.core.insights.ReleaseDate;
import com.iozycore.core.insights.ReleaseEntry;
import com.iozycore.videogame.igdb.IgdbReleaseDates;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;

/** Video game releases: the IGDB date of owned or wanted games, in one call. */
class VideoGameReleasesTest {

    private static final LocalDate NOVEMBER_1 = LocalDate.of(2026, 11, 1);
    private static final LocalDate NOVEMBER_30 = LocalDate.of(2026, 11, 30);

    @Test
    void dates_the_followed_games_known_to_igdb_in_one_call_owned_or_not() {
        Entity owned = game("Hollow Knight: Silksong", "1942");
        Entity wanted = game("Tunic 2", "7346");
        Entity byHand = game("Saisi à la main", null);
        Entity elsewhere = game("Sorti en décembre", "9999");
        owned.setAttribute("coverImageUrl", "https://img/silksong.jpg");
        StubIgdbReleaseDates igdb = new StubIgdbReleaseDates(Map.of(
                "1942", Optional.of(ReleaseDate.ofDay(LocalDate.of(2026, 11, 14))),
                "7346", Optional.of(ReleaseDate.ofDay(LocalDate.of(2026, 11, 3))),
                "9999", Optional.of(ReleaseDate.ofDay(LocalDate.of(2026, 12, 3)))));
        ReleaseContext context = new ReleaseContext(EntityTypeFixtures.VIDEO_GAME, NOVEMBER_1, NOVEMBER_30,
                List.of(owned, wanted, byHand, elsewhere),
                List.of(Ownership.acquire(owned.id(), null, OwnershipCondition.NEW, LocalDate.now(), null),
                        Ownership.acquire(byHand.id(), null, OwnershipCondition.NEW, LocalDate.now(), null),
                        Ownership.acquire(elsewhere.id(), null, OwnershipCondition.NEW, LocalDate.now(), null)),
                List.of(WishlistEntry.add(wanted.id(), LocalDate.now())));

        List<ReleaseEntry> entries = new VideoGameReleases(igdb).releasesBetween(context);

        assertThat(igdb.calls).hasSize(1);
        assertThat(igdb.calls.get(0)).containsExactlyInAnyOrder("1942", "7346", "9999");
        assertThat(entries).extracting(ReleaseEntry::entityTitle)
                .containsExactlyInAnyOrder("Hollow Knight: Silksong", "Tunic 2");
        ReleaseEntry silksong = entries.stream().filter(e -> e.entityId().equals(owned.id())).findFirst().orElseThrow();
        assertThat(silksong.relation()).isEqualTo(ReleaseEntry.Relation.OWNED);
        assertThat(silksong.date()).isEqualTo(ReleaseDate.ofDay(LocalDate.of(2026, 11, 14)));
        assertThat(silksong.coverImageUrl()).isEqualTo("https://img/silksong.jpg");
        assertThat(silksong.source()).isEqualTo("IGDB");
        assertThat(silksong.label()).isEmpty();
        ReleaseEntry tunic = entries.stream().filter(e -> e.entityId().equals(wanted.id())).findFirst().orElseThrow();
        // Not owned, wanted as a whole: it shows as wanted.
        assertThat(tunic.relation()).isEqualTo(ReleaseEntry.Relation.WANTED);
    }

    @Test
    void asks_nothing_when_no_game_comes_from_igdb() {
        Entity byHand = game("Saisi à la main", null);
        StubIgdbReleaseDates igdb = new StubIgdbReleaseDates(Map.of());
        ReleaseContext context = new ReleaseContext(EntityTypeFixtures.VIDEO_GAME, NOVEMBER_1, NOVEMBER_30,
                List.of(byHand), List.of(Ownership.acquire(byHand.id(), null, OwnershipCondition.NEW, LocalDate.now(), null)),
                List.of());

        assertThat(new VideoGameReleases(igdb).releasesBetween(context)).isEmpty();
        assertThat(igdb.calls).isEmpty();
    }

    @Test
    void covers_video_games_only() {
        VideoGameReleases releases = new VideoGameReleases(new StubIgdbReleaseDates(Map.of()));

        assertThat(releases.supports(EntityTypeFixtures.VIDEO_GAME)).isTrue();
        assertThat(releases.supports(EntityTypeFixtures.MANGA)).isFalse();
    }

    private static Entity game(String title, String igdbId) {
        Entity entity = Entity.create(EntityTypeFixtures.VIDEO_GAME.id(), title);
        if (igdbId != null) {
            entity.setAttribute("igdbId", igdbId);
        }
        return entity;
    }

    private static class StubIgdbReleaseDates implements IgdbReleaseDates {
        private final Map<String, Optional<ReleaseDate>> dates;
        final List<Collection<String>> calls = new ArrayList<>();

        StubIgdbReleaseDates(Map<String, Optional<ReleaseDate>> dates) {
            this.dates = dates;
        }

        @Override
        public Map<String, Optional<ReleaseDate>> fetch(Collection<String> igdbIds) {
            calls.add(igdbIds);
            return dates;
        }
    }
}
