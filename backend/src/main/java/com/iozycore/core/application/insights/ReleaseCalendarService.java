package com.iozycore.core.application.insights;

import com.iozycore.core.domain.follow.FollowedWork;
import com.iozycore.core.domain.follow.FollowedWorkRepository;

import com.iozycore.core.domain.catalog.Entity;
import com.iozycore.core.domain.catalog.EntityRepository;
import com.iozycore.core.domain.catalog.EntityType;
import com.iozycore.core.domain.catalog.EntityTypeRepository;
import com.iozycore.core.domain.ownership.Ownership;
import com.iozycore.core.domain.ownership.OwnershipRepository;
import com.iozycore.core.domain.wishlist.WishlistEntry;
import com.iozycore.core.domain.wishlist.WishlistEntryRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import com.iozycore.core.domain.insights.ReleaseCalendar;
import com.iozycore.core.domain.insights.ReleaseContext;
import com.iozycore.core.domain.insights.ReleaseDate;
import com.iozycore.core.domain.insights.ReleaseEntry;

/**
 * The release calendar: what comes out, when, for the works the collector
 * FOLLOWS, OWNS or WANTS - all categories mixed. Following is the third state of a
 * work, next to owning and wanting (see WorkFollowing); any of the three puts a
 * work on the calendar, and the relation says what each release represents
 * for the collection.
 *
 * <h2>Where the dates come from</h2>
 * From two places, and only two. Each universe that has a real
 * source (Google Books for the volumes of a manga, IGDB for a video game) is
 * a {@link ReleaseSource}; the core knows none of them. And for
 * any work, the attribute {@value #RELEASE_DATE_ATTRIBUTE} typed
 * on its detail page - this is what puts board games and custom
 * categories in the same calendar, although no source knows
 * their release day (BoardGameGeek only gives the year).
 *
 * <h2>What it never does</h2>
 * Invent a date. "Upcoming releases" was removed from Discover in batch
 * 142 precisely because no data existed, and the design log
 * (§44) requires that it "never come back with an approximate date". A
 * source that only knows the year puts nothing here.
 *
 * <h2>One read per category, not one per work</h2>
 * Possessions and wishes are read once, the catalog once per
 * category, and each source receives all of this indexed ({@link ReleaseContext})
 * : on 300 series, a source that would reread the possessions per work
 * would cost 300 queries (batch 141).
 */
@Service
@RequiredArgsConstructor
public class ReleaseCalendarService {

    /** The attribute of a work that carries its release date typed by hand: "2026-10-14" or "2026-10". */
    public static final String RELEASE_DATE_ATTRIBUTE = "releaseDate";
    /** The source of a date typed on the detail page - the client names it as such. */
    public static final String MANUAL_SOURCE = "MANUAL";
    /** One year and one day: enough to turn the pages of a whole year, not enough to load all the history. */
    static final int MAX_PERIOD_DAYS = 366;
    /** The bounds of "no period": wider than any date a source can hold. */
    private static final LocalDate EARLIEST = LocalDate.of(1900, 1, 1);
    private static final LocalDate LATEST = LocalDate.of(2200, 12, 31);

    private static final String COVER_IMAGE_URL = "coverImageUrl";

    private static final Comparator<ReleaseEntry> CALENDAR_ORDER = Comparator
            .comparing(ReleaseEntry::date)
            .thenComparing(entry -> entry.entityTitle().toLowerCase())
            .thenComparing(entry -> entry.volumeNumber() == null ? Integer.MIN_VALUE : entry.volumeNumber())
            .thenComparing(ReleaseEntry::label);

    private final EntityTypeRepository entityTypeRepository;
    private final EntityRepository entityRepository;
    private final OwnershipRepository ownershipRepository;
    private final WishlistEntryRepository wishlistEntryRepository;
    private final FollowedWorkRepository followedWorkRepository;
    private final List<ReleaseSource> sources;

    /** True when a universe can date the releases of this category without them being typed. */
    public boolean hasReleaseSource(EntityType entityType) {
        return sources.stream().anyMatch(source -> source.supports(entityType));
    }

    /**
     * @throws IllegalArgumentException period missing, reversed, or longer than a year
     */
    public ReleaseCalendar releasesBetween(LocalDate from, LocalDate to) {
        validatePeriod(from, to);
        return new ReleaseCalendar(from, to, collect(from, to));
    }

    /**
     * The releases with the latest dates, whatever the period: future or past,
     * newest first. The sources only use the period as a filter, so it is opened
     * wide here and the bound of one year, which protects the calendar screen, does
     * not apply.
     *
     * @throws IllegalArgumentException the limit is not positive
     */
    public List<ReleaseEntry> latest(int limit) {
        if (limit < 1) {
            throw new IllegalArgumentException("Le nombre de sorties demandé doit être positif");
        }
        List<ReleaseEntry> entries = collect(EARLIEST, LATEST);
        // Calendar order is oldest first: the newest are at the end.
        List<ReleaseEntry> newestFirst = new ArrayList<>(entries);
        Collections.reverse(newestFirst);
        return newestFirst.stream().limit(limit).toList();
    }

    private List<ReleaseEntry> collect(LocalDate from, LocalDate to) {
        List<Ownership> activeOwnerships = ownershipRepository.findAll().stream()
                .filter(Ownership::isActive)
                .toList();
        List<WishlistEntry> wishlist = wishlistEntryRepository.findAll();
        // A work enters the calendar when the collector cares about it in any of the
        // three ways: they follow it, they own it, or they want it (it is what they
        // see in their collection and their wishes, so it is what they expect here).
        Set<UUID> ofInterest = followedWorkRepository.findAll().stream()
                .map(FollowedWork::entityId)
                .collect(Collectors.toCollection(HashSet::new));
        activeOwnerships.forEach(ownership -> ofInterest.add(ownership.entityId()));
        wishlist.forEach(entry -> ofInterest.add(entry.entityId()));
        if (ofInterest.isEmpty()) {
            // Nothing followed, owned or wanted: no source to consult, no catalog to read.
            return List.of();
        }

        List<ReleaseEntry> entries = new ArrayList<>();
        for (EntityType entityType : entityTypeRepository.findAll()) {
            List<Entity> entities = entityRepository.findAllByType(entityType.id()).stream()
                    .filter(entity -> ofInterest.contains(entity.id()))
                    .toList();
            if (entities.isEmpty()) {
                continue;
            }
            Set<UUID> entityIds = entities.stream().map(Entity::id).collect(Collectors.toSet());
            ReleaseContext context = new ReleaseContext(entityType, from, to, entities,
                    activeOwnerships.stream().filter(o -> entityIds.contains(o.entityId())).toList(),
                    wishlist.stream().filter(w -> entityIds.contains(w.entityId())).toList());

            entries.addAll(manualReleases(context));
            for (ReleaseSource source : sources) {
                if (source.supports(entityType)) {
                    entries.addAll(source.releasesBetween(context));
                }
            }
        }
        entries.sort(CALENDAR_ORDER);
        return entries;
    }

    /** The dates typed on the detail pages - for any category, whether a universe covers it or not. */
    private static List<ReleaseEntry> manualReleases(ReleaseContext context) {
        List<ReleaseEntry> entries = new ArrayList<>();
        for (Entity entity : context.entities()) {
            ReleaseDate.parse(entity.attributes().get(RELEASE_DATE_ATTRIBUTE))
                    .filter(date -> date.isWithin(context.from(), context.to()))
                    .ifPresent(date -> context.relationOf(entity.id()).ifPresent(relation ->
                            entries.add(new ReleaseEntry(date, entity.id(), entity.title(), entity.entityTypeId(),
                                    "", null, null, coverOf(entity), relation, MANUAL_SOURCE))));
        }
        return entries;
    }

    private static String coverOf(Entity entity) {
        Object cover = entity.attributes().get(COVER_IMAGE_URL);
        return cover instanceof String url && !url.isBlank() ? url : null;
    }

    private static void validatePeriod(LocalDate from, LocalDate to) {
        if (from == null || to == null) {
            throw new IllegalArgumentException("La période du calendrier demande un début et une fin");
        }
        if (to.isBefore(from)) {
            throw new IllegalArgumentException("La fin de la période (" + to + ") précède son début (" + from + ")");
        }
        if (ChronoUnit.DAYS.between(from, to) >= MAX_PERIOD_DAYS) {
            throw new IllegalArgumentException("Le calendrier se lit par tranches d'un an au plus");
        }
    }
}
