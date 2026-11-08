package com.iozycore.core.domain.work;

import com.iozycore.core.domain.catalog.Entity;
import com.iozycore.core.domain.catalog.EntityType;
import com.iozycore.core.domain.insights.ReleaseEntry;
import com.iozycore.core.domain.ownership.Ownership;
import com.iozycore.core.domain.wishlist.WishlistEntry;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * What the core has already read before it asks a universe for the elements of
 * its works: the works of one type, the active ownerships and the wishes of the
 * account on them, and their known releases.
 *
 * <p>Read once per type and passed as is: a universe that reread the ownerships
 * work by work would cost one query per work (the same rule as
 * {@link com.iozycore.core.domain.insights.ReleaseContext}).
 */
public record WorkElementsContext(EntityType entityType, List<Entity> works, List<Ownership> activeOwnerships,
                                  List<WishlistEntry> wishlist, List<ReleaseEntry> releases, LocalDate today) {

    private static final String COVER_IMAGE_URL = "coverImageUrl";

    public WorkElementsContext {
        works = List.copyOf(works);
        activeOwnerships = List.copyOf(activeOwnerships);
        wishlist = List.copyOf(wishlist);
        releases = List.copyOf(releases);
    }

    public Map<UUID, List<Ownership>> ownershipsByWork() {
        return activeOwnerships.stream().collect(Collectors.groupingBy(Ownership::entityId));
    }

    public Map<UUID, List<WishlistEntry>> wishesByWork() {
        return wishlist.stream().collect(Collectors.groupingBy(WishlistEntry::entityId));
    }

    public Map<UUID, List<ReleaseEntry>> releasesByWork() {
        return releases.stream().collect(Collectors.groupingBy(ReleaseEntry::entityId));
    }

    /** The cover of a work or of a variant, from the generic attribute every universe writes. */
    public static String coverOf(Map<String, Object> attributes) {
        Object cover = attributes == null ? null : attributes.get(COVER_IMAGE_URL);
        return cover instanceof String url && !url.isBlank() ? url : null;
    }

    /** The earliest release of a list that concerns the whole work (no number), if any. */
    public static Optional<ReleaseEntry> earliestWholeWorkRelease(List<ReleaseEntry> releases) {
        return releases.stream()
                .filter(entry -> entry.volumeNumber() == null)
                .min((a, b) -> a.date().compareTo(b.date()));
    }
}
