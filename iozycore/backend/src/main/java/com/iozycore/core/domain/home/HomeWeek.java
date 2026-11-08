package com.iozycore.core.domain.home;

import com.iozycore.core.domain.insights.ReleaseDate;
import com.iozycore.core.domain.insights.ReleaseEntry;
import com.iozycore.core.domain.work.CollectionSummary;
import com.iozycore.core.domain.work.CollectorStatus;
import com.iozycore.core.domain.work.WorkElement;
import com.iozycore.core.domain.work.WorkView;

import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.time.temporal.TemporalAdjusters;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Stream;

/**
 * The home page "ta semaine": what this week means for the collection, composed
 * from the works read model only - the same counts as every other screen, and
 * nothing written per universe (a custom type can be the lead).
 *
 * <h2>The blocks, each one may be empty</h2>
 * <ul>
 *   <li><b>lead</b>: a work of the collection (owned or wished) with a release this
 *       week - the release closest to today, an upcoming one before a past one;
 *       else the owned work that moved last; else nothing;</li>
 *   <li><b>alsoThisWeek</b>: up to {@value #MAX_ALSO} other works - their release this
 *       week first, by date, then the works moved this week, latest first;</li>
 *   <li><b>figure</b>: the objects of the collection and this month's additions
 *       ({@link CollectionSummary}), {@code null} for an empty collection;</li>
 *   <li><b>almostDone</b>: owned works the collector follows (ONGOING) that lack
 *       between 1 and {@value #MAX_MISSING_ALMOST_DONE} counted elements, fewest first;</li>
 *   <li><b>shelves</b>: per type with an owned work, its works, its objects and up to
 *       {@value #COVERS_PER_SHELF} covers of the works that moved last.</li>
 * </ul>
 *
 * <h2>The week</h2>
 * Monday to Sunday around today, in the collector's calendar. A release counts
 * only when its day is known: a release known to the month is not "this week".
 */
public record HomeWeek(LocalDate weekStart, LocalDate weekEnd, Lead lead, List<Item> alsoThisWeek, Figure figure,
                       List<AlmostDone> almostDone, List<Shelf> shelves) {

    static final int MAX_ALSO = 4;
    static final int MAX_MISSING_ALMOST_DONE = 3;
    static final int MAX_ALMOST_DONE = 4;
    static final int COVERS_PER_SHELF = 3;

    /** Why a work is on the page. */
    public enum Reason {
        /** One of its elements, or the work itself, comes out this week. */
        RELEASE,
        /** The collector added a copy or a wish this week (or, for the lead, last). */
        MOVED
    }

    /** What comes out: "Tome 15" on 2026-11-13, or the work itself (empty label). */
    public record Release(ReleaseDate date, String label, Integer number) {

        public Release {
            Objects.requireNonNull(date, "date");
            label = label == null ? "" : label;
        }

        static Release of(ReleaseEntry entry) {
            return entry == null ? null : new Release(entry.date(), entry.label(), entry.volumeNumber());
        }
    }

    /** @param release the release this week when the reason is RELEASE, else {@code null} */
    public record Lead(WorkView work, Reason reason, Release release, Release nextRelease) {
    }

    /** @param release the release this week when the reason is RELEASE, else {@code null} */
    public record Item(WorkView work, Reason reason, Release release) {
    }

    public record Figure(long totalObjects, long addedThisMonth, int releasesThisWeek) {
    }

    /** @param missing the elements counted as missing, in the order of the work */
    public record AlmostDone(WorkView work, List<WorkElement> missing) {

        public AlmostDone {
            missing = List.copyOf(missing);
        }
    }

    /** @param covers up to three works of the type with a cover, latest moved first */
    public record Shelf(UUID entityTypeId, int workCount, long objectCount, List<WorkView> covers) {

        public Shelf {
            covers = List.copyOf(covers);
        }
    }

    public HomeWeek {
        alsoThisWeek = List.copyOf(alsoThisWeek);
        almostDone = List.copyOf(almostDone);
        shelves = List.copyOf(shelves);
    }

    private static final Comparator<WorkView> LATEST_MOVED_FIRST = Comparator
            .comparing(WorkView::lastMovedAt, Comparator.nullsLast(Comparator.reverseOrder()))
            .thenComparing(view -> view.title().toLowerCase());

    /**
     * Composes the week.
     *
     * @param works   the works of the account (owned or wished), in any order
     * @param summary the objects of the account
     * @param today   today in the collector's calendar
     * @param zone    the collector's time zone, to read when a move happened
     */
    public static HomeWeek compose(List<WorkView> works, CollectionSummary summary, LocalDate today, ZoneId zone) {
        LocalDate monday = today.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
        LocalDate sunday = monday.plusDays(6);
        Instant weekFrom = monday.atStartOfDay(zone).toInstant();
        Instant weekTo = sunday.plusDays(1).atStartOfDay(zone).toInstant();

        List<WorkView> sorted = works.stream().sorted(LATEST_MOVED_FIRST).toList();
        Map<UUID, Release> releases = new LinkedHashMap<>();
        for (WorkView work : sorted) {
            releaseWithin(work, today, monday, sunday).ifPresent(release -> releases.put(work.entityId(), release));
        }
        Comparator<WorkView> byRelease = Comparator.comparing(
                (WorkView work) -> releases.get(work.entityId()), closestTo(today));
        List<WorkView> releasing = sorted.stream().filter(work -> releases.containsKey(work.entityId()))
                .sorted(byRelease).toList();

        Lead lead = lead(sorted, releasing, releases);
        Set<UUID> shown = new LinkedHashSet<>();
        if (lead != null) {
            shown.add(lead.work().entityId());
        }

        List<Item> also = new ArrayList<>();
        Stream.concat(
                        releasing.stream()
                                .sorted(Comparator.comparing((WorkView work) -> releases.get(work.entityId()).date()))
                                .map(work -> new Item(work, Reason.RELEASE, releases.get(work.entityId()))),
                        sorted.stream()
                                .filter(work -> movedWithin(work, weekFrom, weekTo))
                                .map(work -> new Item(work, Reason.MOVED, null)))
                .filter(item -> shown.add(item.work().entityId()))
                .limit(MAX_ALSO)
                .forEach(also::add);

        Figure figure = summary.totalObjects() == 0 ? null
                : new Figure(summary.totalObjects(), summary.addedThisMonth(), releases.size());

        List<AlmostDone> almostDone = sorted.stream()
                .filter(work -> work.ownedCount() > 0)
                .filter(work -> work.collectorStatus() == CollectorStatus.ONGOING)
                .filter(work -> work.missingCount() >= 1 && work.missingCount() <= MAX_MISSING_ALMOST_DONE)
                .sorted(Comparator.comparingInt(WorkView::missingCount))
                .limit(MAX_ALMOST_DONE)
                .map(work -> new AlmostDone(work, work.elements().stream()
                        .filter(WorkView.CountedElement::countedAsMissing)
                        .map(WorkView.CountedElement::element)
                        .toList()))
                .toList();

        return new HomeWeek(monday, sunday, lead, also, figure, almostDone, shelves(sorted, summary));
    }

    private static Lead lead(List<WorkView> sorted, List<WorkView> releasing, Map<UUID, Release> releases) {
        if (!releasing.isEmpty()) {
            WorkView work = releasing.get(0);
            return new Lead(work, Reason.RELEASE, releases.get(work.entityId()), Release.of(work.nextRelease()));
        }
        return sorted.stream()
                .filter(work -> work.ownedCount() > 0 && work.lastMovedAt() != null)
                .findFirst()
                .map(work -> new Lead(work, Reason.MOVED, null, Release.of(work.nextRelease())))
                .orElse(null);
    }

    /**
     * The release of the work this week closest to today: one of its elements
     * with a known day, or its next release.
     */
    static Optional<Release> releaseWithin(WorkView work, LocalDate today, LocalDate monday, LocalDate sunday) {
        Stream<Release> fromElements = work.elements().stream()
                .map(WorkView.CountedElement::element)
                .filter(element -> element.releaseDate() != null)
                .map(element -> new Release(element.releaseDate(), element.label(), element.number()));
        Stream<Release> next = Stream.ofNullable(Release.of(work.nextRelease()));
        return Stream.concat(fromElements, next)
                .filter(release -> release.date().precision() == ReleaseDate.Precision.DAY)
                .filter(release -> !release.date().date().isBefore(monday) && !release.date().date().isAfter(sunday))
                .min(closestTo(today));
    }

    /** Closest to today first; on the same distance, the one still to come. */
    private static Comparator<Release> closestTo(LocalDate today) {
        return Comparator.comparingLong((Release release) ->
                        Math.abs(ChronoUnit.DAYS.between(today, release.date().date())))
                .thenComparing(release -> release.date().date().isBefore(today));
    }

    private static boolean movedWithin(WorkView work, Instant from, Instant to) {
        Instant moved = work.lastMovedAt();
        return moved != null && !moved.isBefore(from) && moved.isBefore(to);
    }

    private static List<Shelf> shelves(List<WorkView> sorted, CollectionSummary summary) {
        Map<UUID, Long> objects = new HashMap<>();
        summary.byType().forEach(count -> objects.put(count.entityTypeId(), count.count()));
        Map<UUID, List<WorkView>> ownedByType = new LinkedHashMap<>();
        sorted.stream().filter(work -> work.ownedCount() > 0)
                .forEach(work -> ownedByType.computeIfAbsent(work.entityTypeId(), t -> new ArrayList<>()).add(work));
        return ownedByType.entrySet().stream()
                .map(entry -> new Shelf(entry.getKey(), entry.getValue().size(),
                        objects.getOrDefault(entry.getKey(), 0L),
                        entry.getValue().stream().filter(work -> work.coverImageUrl() != null
                                && !work.coverImageUrl().isBlank()).limit(COVERS_PER_SHELF).toList()))
                .sorted(Comparator.comparingLong(Shelf::objectCount).reversed()
                        .thenComparing(Comparator.comparingInt(Shelf::workCount).reversed()))
                .toList();
    }
}
