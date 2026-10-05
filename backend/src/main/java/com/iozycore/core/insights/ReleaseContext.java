package com.iozycore.core.insights;

import com.iozycore.core.domain.catalog.Entity;
import com.iozycore.core.domain.catalog.EntityType;
import com.iozycore.core.domain.ownership.Ownership;
import com.iozycore.core.domain.wishlist.WishlistEntry;

import java.time.LocalDate;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

/**
 * What the core has read for a category before asking a
 * universe for its releases: the works the user is interested in (owned or wished),
 * their active possessions and their wishes.
 *
 * <p>Read once per category, and passed as is to each source: on 300
 * series, a universe that would reread the possessions work by work would cost
 * 300 queries (measure of batch 141 on Discover). Here everything is already in
 * memory, indexed by work.
 */
public record ReleaseContext(EntityType entityType, LocalDate from, LocalDate to, List<Entity> entities,
                              List<Ownership> activeOwnerships, List<WishlistEntry> wishlist) {

    public ReleaseContext {
        entities = List.copyOf(entities);
        activeOwnerships = List.copyOf(activeOwnerships);
        wishlist = List.copyOf(wishlist);
    }

    /** The ids of the volumes (Variant) owned, per work - empty for a possession of the whole work. */
    public Map<UUID, Set<UUID>> ownedVariantIdsByEntity() {
        Map<UUID, Set<UUID>> result = new HashMap<>();
        for (Ownership ownership : activeOwnerships) {
            Set<UUID> variants = result.computeIfAbsent(ownership.entityId(), id -> new HashSet<>());
            ownership.variantId().ifPresent(variants::add);
        }
        return result;
    }

    public boolean isOwned(UUID entityId) {
        return activeOwnerships.stream().anyMatch(ownership -> ownership.entityId().equals(entityId));
    }

    /** The whole work is wanted (a wish with no specific volume). */
    public boolean isWanted(UUID entityId) {
        return wishlist.stream().anyMatch(entry -> entry.entityId().equals(entityId) && entry.variantId().isEmpty());
    }

    /** The specific volumes wanted, per work. */
    public Map<UUID, Set<UUID>> wantedVariantIdsByEntity() {
        Map<UUID, Set<UUID>> result = new HashMap<>();
        for (WishlistEntry entry : wishlist) {
            entry.variantId().ifPresent(variantId ->
                    result.computeIfAbsent(entry.entityId(), id -> new HashSet<>()).add(variantId));
        }
        return result;
    }

    /** The relation of a whole work to the collection - owned first, wanted otherwise. */
    public Optional<ReleaseEntry.Relation> relationOf(UUID entityId) {
        // A work of the context is followed by construction: its release is
        // owned, or to buy. The wish no longer exists at its level (one state at
        // a time), only at the volume - see the universes.
        return Optional.of(isOwned(entityId) ? ReleaseEntry.Relation.OWNED : ReleaseEntry.Relation.MISSING);
    }
}
