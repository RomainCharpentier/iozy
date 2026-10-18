package com.iozycore.core.domain.wishlist;

import com.iozycore.core.domain.shared.DomainEvent;

import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Aggregate root for the wish to acquire a collectible item.
 * Its own life cycle: added, removed, or converted to an Ownership
 * (the conversion itself is orchestrated in the application layer, which
 * creates the Ownership then deletes the wishlist entry).
 * <p>
 * Carries an ownerId, but does not CHOOSE it: at creation it is
 * null - "not yet assigned". The session decides, at write time,
 * through the column marked @TenantId (see
 * ProprietaireCourant). Read back from the database, it carries the real owner
 * of the row.
 * <p>
 * <b>What a wish is about.</b> The really collectible item of the
 * type, not its group (see the product study of 2026-08-27). For a
 * manga, it is the VOLUME: "do you want Naruto?" has no useful answer when
 * thirty are missing. For a type with no notion of volume (video game, board
 * game), the work IS the collectible item and {@code variantId} stays
 * empty - exactly like {@code Ownership.variantId}, empty for the same
 * reason.
 * <p>
 * <b>Exclusive of ownership.</b> Wanting and having are two states of the
 * same item, never two superposed states: the rule is held in the
 * application layer (see WishlistController when adding, QuickAddService when
 * acquiring), where both repositories are visible at once.
 */
public class WishlistEntry {

    private final UUID id;
    private final UUID entityId;
    private final UUID variantId;
    private final UUID ownerId;
    private final LocalDate addedAt;
    private final List<DomainEvent> pendingEvents = new ArrayList<>();

    private WishlistEntry(UUID id, UUID entityId, UUID variantId, UUID ownerId, LocalDate addedAt) {
        this.id = id;
        this.entityId = entityId;
        this.variantId = variantId;
        this.ownerId = ownerId;
        this.addedAt = addedAt;
    }

    /** Wish about a specific VOLUME - the normal case for a manga. */
    public static WishlistEntry addVariant(UUID entityId, UUID variantId, LocalDate addedAt) {
        if (variantId == null) {
            throw new IllegalArgumentException("Une envie de tome doit référencer le tome voulu");
        }
        return creer(entityId, variantId, addedAt);
    }

    /** Wish about the whole WORK - reserved for types with no notion of
     *  volume, where the work is itself the collectible item. */
    public static WishlistEntry add(UUID entityId, LocalDate addedAt) {
        return creer(entityId, null, addedAt);
    }

    private static WishlistEntry creer(UUID entityId, UUID variantId, LocalDate addedAt) {
        // Without this guard, a body without entityId went down to Hibernate,
        // which raised its constraint violation as a 500 (Batch 28). Only
        // reconstitute() stays unchecked: it reads back what the database already
        // contains, it creates nothing.
        if (entityId == null) {
            throw new IllegalArgumentException("Une entrée de wishlist doit référencer une œuvre");
        }
        WishlistEntry entry = new WishlistEntry(UUID.randomUUID(), entityId, variantId, null, addedAt);
        entry.pendingEvents.add(new EntityAddedToWishlist(entry.id, entityId, Instant.now()));
        return entry;
    }

    public static WishlistEntry reconstitute(UUID id, UUID entityId, UUID variantId, UUID ownerId, LocalDate addedAt) {
        return new WishlistEntry(id, entityId, variantId, ownerId, addedAt);
    }

    public List<DomainEvent> pullDomainEvents() {
        List<DomainEvent> events = List.copyOf(pendingEvents);
        pendingEvents.clear();
        return events;
    }

    public UUID id() {
        return id;
    }

    public UUID entityId() {
        return entityId;
    }

    /** The wanted volume, empty when the wish is about the whole work. */
    public Optional<UUID> variantId() {
        return Optional.ofNullable(variantId);
    }

    public UUID ownerId() {
        return ownerId;
    }

    public LocalDate addedAt() {
        return addedAt;
    }
}
