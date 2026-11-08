package com.iozycore.core.application.work;

import com.iozycore.core.application.NotFoundException;
import com.iozycore.core.application.insights.ReleaseCalendarService;
import com.iozycore.core.domain.catalog.Entity;
import com.iozycore.core.domain.catalog.EntityRepository;
import com.iozycore.core.domain.catalog.EntityType;
import com.iozycore.core.domain.catalog.EntityTypeRepository;
import com.iozycore.core.domain.insights.ReleaseContext;
import com.iozycore.core.domain.insights.ReleaseEntry;
import com.iozycore.core.domain.ownership.Ownership;
import com.iozycore.core.domain.ownership.OwnershipRepository;
import com.iozycore.core.domain.wishlist.WishlistEntry;
import com.iozycore.core.domain.wishlist.WishlistEntryRepository;
import com.iozycore.core.domain.work.CollectionSummary;
import com.iozycore.core.domain.work.CollectorStatus;
import com.iozycore.core.domain.work.DefaultWorkElements;
import com.iozycore.core.domain.work.WorkCollectorStatus;
import com.iozycore.core.domain.work.WorkCollectorStatusRepository;
import com.iozycore.core.domain.work.WorkElements;
import com.iozycore.core.domain.work.WorkElementsContext;
import com.iozycore.core.domain.work.WorkView;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.ZoneId;
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
import java.util.function.Function;
import java.util.stream.Collectors;
import java.util.stream.Stream;

/**
 * The works of the collector and their elements, for every type: the single
 * entity page, the home page and the "to buy" page read the same counts.
 *
 * <h2>Who says what</h2>
 * The universe that covers a type says what a work is made of
 * ({@link WorkElementsSource}); a type nobody covers - a custom type - gets
 * {@link DefaultWorkElements}. This class adds what holds for every type: the
 * collector status, the counts, the next release and the last move.
 *
 * <h2>The cost does not grow with the collection</h2>
 * The list reads the ownerships, the wishes, the statuses, the works and their
 * last change once each, then asks each type once (elements and releases).
 * Checked by {@code WorksSansN1Test}.
 *
 * <h2>Last move</h2>
 * The latest of what THIS account did: a copy created (still owned or not:
 * selling a copy keeps its creation as a move) or a wish added. The catalog is
 * shared, so a change to the work itself (another account's edit, a metadata
 * refresh) is not a move of mine and never reorders my list. A newly announced
 * release would belong here too, but no source stores when it learnt of a
 * release yet, so it is not counted (never guessed).
 *
 * <h2>The collector's calendar</h2>
 * "Today" and "this month" are read in the collector's time zone
 * ({@code iozycore.collector-time-zone}, Europe/Paris by default), not the
 * server's (UTC in Docker): a copy added on the 1st at 00:30 in Paris belongs
 * to that month.
 */
@Service
@Transactional(readOnly = true)
public class WorkReadModel {

    /** One year minus a day: the longest period the release sources accept. */
    private static final int RELEASE_HORIZON_DAYS = 365;

    private final EntityRepository entityRepository;
    private final EntityTypeRepository entityTypeRepository;
    private final OwnershipRepository ownershipRepository;
    private final WishlistEntryRepository wishlistEntryRepository;
    private final WorkCollectorStatusRepository statusRepository;
    private final ReleaseCalendarService releaseCalendar;
    private final List<WorkElementsSource> sources;
    private final Clock clock;

    @Autowired
    public WorkReadModel(EntityRepository entityRepository, EntityTypeRepository entityTypeRepository,
                         OwnershipRepository ownershipRepository, WishlistEntryRepository wishlistEntryRepository,
                         WorkCollectorStatusRepository statusRepository, ReleaseCalendarService releaseCalendar,
                         List<WorkElementsSource> sources,
                         @Value("${iozycore.collector-time-zone:Europe/Paris}") String collectorTimeZone) {
        this(entityRepository, entityTypeRepository, ownershipRepository, wishlistEntryRepository, statusRepository,
                releaseCalendar, sources, Clock.system(ZoneId.of(collectorTimeZone)));
    }

    WorkReadModel(EntityRepository entityRepository, EntityTypeRepository entityTypeRepository,
                  OwnershipRepository ownershipRepository, WishlistEntryRepository wishlistEntryRepository,
                  WorkCollectorStatusRepository statusRepository, ReleaseCalendarService releaseCalendar,
                  List<WorkElementsSource> sources, Clock clock) {
        this.entityRepository = entityRepository;
        this.entityTypeRepository = entityTypeRepository;
        this.ownershipRepository = ownershipRepository;
        this.wishlistEntryRepository = wishlistEntryRepository;
        this.statusRepository = statusRepository;
        this.releaseCalendar = releaseCalendar;
        this.sources = List.copyOf(sources);
        this.clock = clock;
    }

    /** The zone of the collector's calendar - read by the test of the wiring. */
    ZoneId collectorZone() {
        return clock.getZone();
    }

    /**
     * One work of the catalog, owned or not: a work nobody owns still has a page.
     *
     * @throws NotFoundException the work does not exist
     */
    public WorkView work(UUID entityId) {
        Entity work = entityRepository.findById(entityId)
                .orElseThrow(() -> new NotFoundException("Œuvre introuvable : " + entityId));
        EntityType type = entityTypeRepository.findById(work.entityTypeId())
                .orElseThrow(() -> new NotFoundException("Type introuvable pour l'œuvre : " + entityId));
        List<Ownership> ownerships = ownershipRepository.findByEntityId(entityId);
        List<WishlistEntry> wishes = wishlistEntryRepository.findAllByEntityId(entityId);
        Map<UUID, CollectorStatus> statuses = statusRepository.findByEntityId(entityId)
                .map(status -> Map.of(status.entityId(), status.status()))
                .orElse(Map.of());
        return viewsOf(Map.of(type, List.of(work)), ownerships, wishes, statuses, false).get(0);
    }

    /**
     * Every work the account owns (an active copy) or wishes, most recently moved first.
     *
     * <p>The counts of a list can be summed: each object belongs to one work only. The derived
     * elements that stand for another work (another game of a licence, an expansion owned as a
     * game of its own) are left out here and shown on the page of the work only
     * ({@link WorkElementsContext#list()}).
     */
    public List<WorkView> works() {
        List<Ownership> ownerships = ownershipRepository.findAll();
        List<WishlistEntry> wishes = wishlistEntryRepository.findAll();
        Set<UUID> ids = new LinkedHashSet<>();
        ownerships.stream().filter(Ownership::isActive).forEach(o -> ids.add(o.entityId()));
        wishes.forEach(w -> ids.add(w.entityId()));
        return viewsSorted(ids, ownerships, wishes);
    }

    /**
     * Some works of the catalog, owned or not, read in one batch like {@link #works()}
     * (a work followed but neither owned nor wished, for the home page). An unknown id is skipped.
     */
    public List<WorkView> works(Set<UUID> ids) {
        if (ids == null || ids.isEmpty()) {
            return List.of();
        }
        return viewsSorted(new LinkedHashSet<>(ids), ownershipRepository.findAll(), wishlistEntryRepository.findAll());
    }

    private List<WorkView> viewsSorted(Set<UUID> ids, List<Ownership> ownerships, List<WishlistEntry> wishes) {
        if (ids.isEmpty()) {
            return List.of();
        }
        Map<UUID, EntityType> typesById = entityTypeRepository.findAll().stream()
                .collect(Collectors.toMap(EntityType::id, Function.identity()));
        Map<EntityType, List<Entity>> worksByType = new LinkedHashMap<>();
        for (Entity work : entityRepository.findAllById(ids)) {
            EntityType type = typesById.get(work.entityTypeId());
            if (type != null) {
                worksByType.computeIfAbsent(type, t -> new ArrayList<>()).add(work);
            }
        }
        Map<UUID, CollectorStatus> statuses = statusRepository.findAll().stream()
                .collect(Collectors.toMap(WorkCollectorStatus::entityId, WorkCollectorStatus::status, (a, b) -> a));
        List<WorkView> views = new ArrayList<>(viewsOf(worksByType, ownerships, wishes, statuses, true));
        views.sort(Comparator.comparing(WorkView::lastMovedAt, Comparator.nullsLast(Comparator.reverseOrder()))
                .thenComparing(view -> view.title().toLowerCase()));
        return views;
    }

    /**
     * Sets where the collector stands with a work. Idempotent.
     *
     * @throws NotFoundException the work does not exist
     * @throws IllegalArgumentException no status given
     */
    @Transactional
    public CollectorStatus setCollectorStatus(UUID entityId, CollectorStatus status) {
        if (status == null) {
            throw new IllegalArgumentException("Il faut dire où en est la série : ONGOING, PAUSED ou DROPPED");
        }
        if (entityId == null || entityRepository.findById(entityId).isEmpty()) {
            throw new NotFoundException("Œuvre introuvable : " + entityId);
        }
        Instant now = clock.instant();
        WorkCollectorStatus saved = statusRepository.findByEntityId(entityId)
                .map(existing -> existing.changeTo(status, now))
                .orElseGet(() -> WorkCollectorStatus.create(entityId, status, now));
        return statusRepository.save(saved).status();
    }

    /** See {@link CollectionSummary} for the one definition of an object. */
    public CollectionSummary summary() {
        List<Ownership> active = ownershipRepository.findAll().stream().filter(Ownership::isActive).toList();
        if (active.isEmpty()) {
            return new CollectionSummary(0, 0, List.of(), List.of());
        }
        Map<UUID, UUID> typeOfWork = entityRepository.findAllById(
                        active.stream().map(Ownership::entityId).collect(Collectors.toSet())).stream()
                .collect(Collectors.toMap(Entity::id, Entity::entityTypeId));
        YearMonth thisMonth = YearMonth.now(clock);
        ZoneId zone = clock.getZone();
        Map<UUID, Long> byType = new LinkedHashMap<>();
        Map<UUID, Long> addedByType = new LinkedHashMap<>();
        long total = 0;
        long added = 0;
        for (Ownership ownership : active) {
            UUID typeId = typeOfWork.get(ownership.entityId());
            if (typeId == null) {
                continue;
            }
            total++;
            byType.merge(typeId, 1L, Long::sum);
            if (ownership.createdAt() != null
                    && YearMonth.from(ownership.createdAt().atZone(zone)).equals(thisMonth)) {
                added++;
                addedByType.merge(typeId, 1L, Long::sum);
            }
        }
        return new CollectionSummary(total, added, counts(addedByType), counts(byType));
    }

    private static List<CollectionSummary.TypeCount> counts(Map<UUID, Long> byType) {
        return byType.entrySet().stream()
                .map(entry -> new CollectionSummary.TypeCount(entry.getKey(), entry.getValue()))
                .sorted(Comparator.comparingLong(CollectionSummary.TypeCount::count).reversed())
                .toList();
    }

    private List<WorkView> viewsOf(Map<EntityType, List<Entity>> worksByType, List<Ownership> ownerships,
                                   List<WishlistEntry> wishes, Map<UUID, CollectorStatus> statuses,
                                   boolean list) {
        LocalDate today = LocalDate.now(clock);
        List<Ownership> active = ownerships.stream().filter(Ownership::isActive).toList();
        Map<UUID, List<Ownership>> allOwnershipsByWork = ownerships.stream()
                .collect(Collectors.groupingBy(Ownership::entityId));
        Map<UUID, List<WishlistEntry>> wishesByWork = wishes.stream()
                .collect(Collectors.groupingBy(WishlistEntry::entityId));

        List<WorkView> views = new ArrayList<>();
        for (Map.Entry<EntityType, List<Entity>> byType : worksByType.entrySet()) {
            EntityType type = byType.getKey();
            List<Entity> works = byType.getValue();
            Set<UUID> ids = works.stream().map(Entity::id).collect(Collectors.toSet());
            List<Ownership> activeOfType = active.stream().filter(o -> ids.contains(o.entityId())).toList();
            List<WishlistEntry> wishesOfType = wishes.stream().filter(w -> ids.contains(w.entityId())).toList();

            List<ReleaseEntry> releases = releaseCalendar.releasesOf(new ReleaseContext(type, today,
                    today.plusDays(RELEASE_HORIZON_DAYS), works, activeOfType, wishesOfType));
            WorkElementsContext context = new WorkElementsContext(type, works, activeOfType, wishesOfType,
                    releases, today, list);
            Map<UUID, WorkElements> elements = elementsOf(context);
            Map<UUID, List<ReleaseEntry>> releasesByWork = context.releasesByWork();

            for (Entity work : works) {
                List<WishlistEntry> workWishes = wishesByWork.getOrDefault(work.id(), List.of());
                ReleaseEntry next = releasesByWork.getOrDefault(work.id(), List.of()).stream()
                        .min(Comparator.comparing(ReleaseEntry::date)
                                .thenComparing(e -> e.volumeNumber() == null ? 0 : e.volumeNumber()))
                        .orElse(null);
                Instant lastMoved = latest(Stream.concat(
                        allOwnershipsByWork.getOrDefault(work.id(), List.of()).stream().map(Ownership::createdAt),
                        workWishes.stream().map(w -> w.addedAt().atStartOfDay(clock.getZone()).toInstant())));
                views.add(WorkView.of(work.id(), work.entityTypeId(), work.title(),
                        WorkElementsContext.coverOf(work.attributes()), elements.get(work.id()),
                        statuses.get(work.id()), workWishes.size(), next, lastMoved, today));
            }
        }
        return views;
    }

    /** The source that covers the type, completed by the core default for any work it leaves out. */
    private Map<UUID, WorkElements> elementsOf(WorkElementsContext context) {
        Map<UUID, WorkElements> result = new HashMap<>();
        Optional<WorkElementsSource> source = sources.stream()
                .filter(candidate -> candidate.supports(context.entityType()))
                .findFirst();
        source.ifPresent(s -> s.elementsOf(context).forEach(elements -> result.put(elements.entityId(), elements)));
        List<Entity> leftOut = context.works().stream().filter(work -> !result.containsKey(work.id())).toList();
        if (!leftOut.isEmpty()) {
            WorkElementsContext rest = new WorkElementsContext(context.entityType(), leftOut,
                    context.activeOwnerships(), context.wishlist(), context.releases(), context.today(),
                    context.list());
            DefaultWorkElements.of(rest).forEach(elements -> result.put(elements.entityId(), elements));
        }
        return result;
    }

    private static Instant latest(Stream<Instant> instants) {
        return instants.filter(Objects::nonNull).max(Comparator.naturalOrder()).orElse(null);
    }
}
