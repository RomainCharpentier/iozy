package com.iozycore.core.domain.home;

import com.iozycore.core.domain.insights.ReleaseDate;
import com.iozycore.core.domain.insights.ReleaseEntry;
import com.iozycore.core.domain.work.CollectionSummary;
import com.iozycore.core.domain.work.CollectorStatus;
import com.iozycore.core.domain.work.WorkElement;
import com.iozycore.core.domain.work.WorkView;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/** The rules of the home page "ta semaine", on works of any type. */
class HomeWeekTest {

    /** A Wednesday: the week runs from Monday 9 to Sunday 15 November. */
    private static final LocalDate TODAY = LocalDate.of(2026, 11, 11);
    private static final ZoneId PARIS = ZoneId.of("Europe/Paris");
    private static final UUID MANGA = UUID.randomUUID();
    private static final UUID GAMES = UUID.randomUUID();
    private static final UUID FIGURINES = UUID.randomUUID();
    private static final CollectionSummary EMPTY = new CollectionSummary(0, 0, List.of(), List.of());

    /** A work under construction. */
    private static final class Work {
        final UUID id = UUID.randomUUID();
        UUID type = MANGA;
        String title = "Œuvre";
        String cover = "https://covers.example/" + id + ".jpg";
        CollectorStatus status = CollectorStatus.ONGOING;
        int owned = 1;
        int wished;
        Integer total = 10;
        Instant moved = Instant.parse("2026-10-01T10:00:00Z");
        ReleaseEntry next;
        final List<WorkView.CountedElement> elements = new ArrayList<>();

        Work titled(String value) { title = value; return this; }
        Work type(UUID value) { type = value; return this; }
        Work owned(int value) { owned = value; return this; }
        Work wished(int value) { wished = value; return this; }
        Work moved(String instant) { moved = Instant.parse(instant); return this; }
        Work status(CollectorStatus value) { status = value; return this; }
        Work noCover() { cover = null; return this; }
        Work unknownTotal() { total = null; return this; }

        Work next(ReleaseDate date, String label, Integer number) {
            next = new ReleaseEntry(date, id, title, type, label, number, null, null,
                    ReleaseEntry.Relation.MISSING, "test");
            return this;
        }

        Work element(int number, WorkElement.State state, ReleaseDate releaseDate, boolean counted) {
            elements.add(new WorkView.CountedElement(new WorkElement("volume-" + number, "Tome " + number, number,
                    null, state, releaseDate, null, null), counted));
            return this;
        }

        Work missing(int count) {
            for (int i = 1; i <= count; i++) {
                element(100 + i, WorkElement.State.MISSING, null, true);
            }
            return this;
        }

        WorkView view() {
            int missing = (int) elements.stream().filter(WorkView.CountedElement::countedAsMissing).count();
            return new WorkView(id, type, title, cover, status, owned, total, missing, wished, elements, next, moved);
        }
    }

    private static Work work(String title) {
        return new Work().titled(title);
    }

    private static ReleaseDate day(int dayOfNovember) {
        return ReleaseDate.ofDay(LocalDate.of(2026, 11, dayOfNovember));
    }

    private static HomeWeek compose(CollectionSummary summary, WorkView... works) {
        return HomeWeek.compose(List.of(works), summary, TODAY, PARIS);
    }

    @Test
    void a_new_account_gets_every_block_empty() {
        HomeWeek week = compose(EMPTY);

        assertThat(week.weekStart()).isEqualTo(LocalDate.of(2026, 11, 9));
        assertThat(week.weekEnd()).isEqualTo(LocalDate.of(2026, 11, 15));
        assertThat(week.lead()).isNull();
        assertThat(week.alsoThisWeek()).isEmpty();
        assertThat(week.figure()).isNull();
        assertThat(week.almostDone()).isEmpty();
        assertThat(week.shelves()).isEmpty();
    }

    @Test
    void a_release_this_week_leads_before_the_work_that_moved_last_and_a_custom_type_can_lead() {
        WorkView moved = work("Frieren").moved("2026-11-11T08:00:00Z").view();
        WorkView statue = work("Totoro").type(FIGURINES).next(day(13), "", null).view();

        HomeWeek week = compose(EMPTY, moved, statue);

        assertThat(week.lead().work().entityId()).isEqualTo(statue.entityId());
        assertThat(week.lead().reason()).isEqualTo(HomeWeek.Reason.RELEASE);
        assertThat(week.lead().release().date()).isEqualTo(day(13));
        assertThat(week.lead().nextRelease().date()).isEqualTo(day(13));
    }

    @Test
    void the_release_closest_to_today_leads_and_one_still_to_come_beats_a_past_one() {
        WorkView past = work("Passé").element(3, WorkElement.State.OWNED, day(10), false).view();
        WorkView coming = work("À venir").next(day(12), "Tome 15", 15).view();
        WorkView later = work("Plus tard").next(day(15), "Tome 2", 2).view();

        HomeWeek week = compose(EMPTY, later, past, coming);

        assertThat(week.lead().work().title()).isEqualTo("À venir");
        assertThat(week.lead().release().label()).isEqualTo("Tome 15");
        assertThat(week.lead().release().number()).isEqualTo(15);
        // The others come out this week too: by date.
        assertThat(week.alsoThisWeek()).extracting(item -> item.work().title()).containsExactly("Passé", "Plus tard");
        assertThat(week.alsoThisWeek()).allMatch(item -> item.reason() == HomeWeek.Reason.RELEASE);
    }

    @Test
    void a_release_known_to_the_month_or_next_week_is_not_this_week() {
        WorkView month = work("Au mois").next(ReleaseDate.ofMonth(YearMonth.of(2026, 11)), "Tome 4", 4)
                .moved("2026-09-01T10:00:00Z").view();
        WorkView nextWeek = work("Semaine prochaine").next(day(16), "Tome 9", 9)
                .moved("2026-08-01T10:00:00Z").view();
        WorkView lastMoved = work("Dernier bougé").moved("2026-10-20T10:00:00Z").view();

        HomeWeek week = compose(EMPTY, month, nextWeek, lastMoved);

        assertThat(week.lead().reason()).isEqualTo(HomeWeek.Reason.MOVED);
        assertThat(week.lead().work().title()).isEqualTo("Dernier bougé");
        assertThat(week.lead().release()).isNull();
        assertThat(week.alsoThisWeek()).isEmpty();
    }

    @Test
    void a_work_only_wished_never_leads_for_having_moved() {
        WorkView wish = work("Envie").owned(0).wished(1).moved("2026-11-11T08:00:00Z").view();
        WorkView owned = work("Possédé").moved("2026-11-01T08:00:00Z").view();

        assertThat(compose(EMPTY, wish, owned).lead().work().title()).isEqualTo("Possédé");
        assertThat(compose(EMPTY, wish).lead()).isNull();
    }

    @Test
    void also_this_week_lists_releases_then_moves_of_the_week_without_the_lead_and_at_most_four() {
        WorkView lead = work("Une").next(day(11), "Tome 1", 1).view();
        WorkView release = work("Sortie").next(day(14), "Tome 7", 7).moved("2026-11-10T09:00:00Z").view();
        WorkView movedMonday = work("Lundi").moved("2026-11-08T23:30:00Z").view(); // Monday 00:30 in Paris
        WorkView movedTuesday = work("Mardi").moved("2026-11-10T08:00:00Z").view();
        WorkView movedWednesday = work("Mercredi").moved("2026-11-11T08:00:00Z").view();
        WorkView movedThursday = work("Jeudi").owned(0).wished(1).moved("2026-11-11T09:00:00Z").view();
        WorkView movedLastWeek = work("Dimanche dernier").moved("2026-11-08T22:30:00Z").view(); // Sunday 23:30

        HomeWeek week = compose(EMPTY, movedLastWeek, movedMonday, lead, movedTuesday, release, movedWednesday,
                movedThursday);

        assertThat(week.lead().work().title()).isEqualTo("Une");
        assertThat(week.alsoThisWeek()).extracting(item -> item.work().title())
                .containsExactly("Sortie", "Jeudi", "Mercredi", "Mardi");
        assertThat(week.alsoThisWeek().get(1).reason()).isEqualTo(HomeWeek.Reason.MOVED);
        assertThat(week.alsoThisWeek().get(1).release()).isNull();

        HomeWeek fewer = compose(EMPTY, movedLastWeek, movedMonday);
        // The lead is Monday's work; last Sunday is not this week.
        assertThat(fewer.lead().work().title()).isEqualTo("Lundi");
        assertThat(fewer.alsoThisWeek()).isEmpty();
    }

    @Test
    void the_figure_is_the_objects_with_this_month_and_the_releases_of_the_week() {
        WorkView coming = work("À venir").next(day(12), "Tome 15", 15).view();
        CollectionSummary summary = new CollectionSummary(45, 3, List.of(), List.of());

        HomeWeek.Figure figure = compose(summary, coming, work("Autre").view()).figure();

        assertThat(figure.totalObjects()).isEqualTo(45);
        assertThat(figure.addedThisMonth()).isEqualTo(3);
        assertThat(figure.releasesThisWeek()).isEqualTo(1);
    }

    @Test
    void almost_done_keeps_owned_ongoing_works_missing_one_to_three_fewest_first() {
        WorkView two = work("Deux").missing(2).view();
        WorkView one = work("Un").missing(1).view();
        WorkView three = work("Trois").missing(3).view();
        WorkView four = work("Quatre").missing(4).view();
        WorkView complete = work("Complet").view();
        // Counted as missing on purpose: only its status keeps it out.
        WorkView paused = work("En pause").status(CollectorStatus.PAUSED).missing(1).view();
        WorkView wishOnly = work("Envie").owned(0).wished(1).missing(1).view();

        List<HomeWeek.AlmostDone> almostDone = compose(EMPTY, two, one, three, four, complete, paused, wishOnly)
                .almostDone();

        assertThat(almostDone).extracting(a -> a.work().title()).containsExactly("Un", "Deux", "Trois");
        assertThat(almostDone.get(1).missing()).extracting(WorkElement::label).containsExactly("Tome 101", "Tome 102");
    }

    @Test
    void almost_done_never_claims_a_work_with_an_unknown_total() {
        // Volume 2 owned, total unknown: volume 1 is a gap, not "one left".
        WorkView unknown = work("Sans total").unknownTotal()
                .element(1, WorkElement.State.MISSING, null, true)
                .element(2, WorkElement.State.OWNED, null, false)
                .view();
        WorkView known = work("Avec total").missing(1).view();

        assertThat(compose(EMPTY, unknown, known).almostDone()).extracting(a -> a.work().title())
                .containsExactly("Avec total");
    }

    @Test
    void almost_done_lists_only_the_elements_counted_as_missing() {
        WorkView series = work("Série")
                .element(1, WorkElement.State.OWNED, null, false)
                .element(2, WorkElement.State.MISSING, null, true)
                .element(3, WorkElement.State.UPCOMING, day(20), false)
                .view();

        assertThat(compose(EMPTY, series).almostDone().get(0).missing())
                .extracting(WorkElement::number).containsExactly(2);
    }

    @Test
    void the_shelves_count_each_type_with_an_owned_work_custom_ones_included_with_three_covers() {
        WorkView m1 = work("M1").moved("2026-11-04T10:00:00Z").view();
        WorkView m2 = work("M2").moved("2026-11-03T10:00:00Z").view();
        WorkView m3 = work("M3").noCover().moved("2026-11-05T10:00:00Z").view();
        WorkView m4 = work("M4").moved("2026-11-02T10:00:00Z").view();
        WorkView m5 = work("M5").moved("2026-11-01T10:00:00Z").view();
        WorkView statue = work("Statue").type(FIGURINES).view();
        WorkView wishedGame = work("Jeu voulu").type(GAMES).owned(0).wished(1).view();
        CollectionSummary summary = new CollectionSummary(12, 0, List.of(), List.of(
                new CollectionSummary.TypeCount(MANGA, 10), new CollectionSummary.TypeCount(FIGURINES, 2)));

        List<HomeWeek.Shelf> shelves = compose(summary, m5, statue, m4, m3, wishedGame, m2, m1).shelves();

        assertThat(shelves).extracting(HomeWeek.Shelf::entityTypeId).containsExactly(MANGA, FIGURINES);
        HomeWeek.Shelf manga = shelves.get(0);
        assertThat(manga.workCount()).isEqualTo(5);
        assertThat(manga.objectCount()).isEqualTo(10);
        // Latest moved first, a work with no cover skipped.
        assertThat(manga.covers()).extracting(WorkView::title).containsExactly("M1", "M2", "M4");
        assertThat(shelves.get(1).objectCount()).isEqualTo(2);
        assertThat(shelves.get(1).covers()).extracting(WorkView::title).containsExactly("Statue");
    }
}
