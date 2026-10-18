package com.iozycore.core.domain.follow;

import java.time.LocalDate;
import java.util.UUID;

/**
 * A FOLLOWED work: one whose new releases we are waiting for.
 *
 * <p>The third state of a work for a collector, next to Owned
 * (see Ownership) and Wish (see WishlistEntry) - a trinity where each
 * state is unique (user feedback of 2026-09-11). Owning says what we
 * have, wishing what we would like, following what we collect as the
 * releases come: it is the followed work, and only it, that enters the
 * release calendar. A volume of a followed series can stay owned or to buy:
 * the state is for the work, the release says the rest.
 *
 * <p>A CORE concept, for every type: manga adds its followed
 * edition to it, which says WHICH of its editions we collect.
 *
 * <p>The owner is not known to the domain: Hibernate sets it at
 * insert time from the session (see {@code @TenantId} on the persistence side),
 * like for a wish or an ownership.
 */
public class FollowedWork {

    private final UUID id;
    private final UUID entityId;
    private final UUID ownerId;
    private final LocalDate followedAt;

    private FollowedWork(UUID id, UUID entityId, UUID ownerId, LocalDate followedAt) {
        this.id = id;
        this.entityId = entityId;
        this.ownerId = ownerId;
        this.followedAt = followedAt;
    }

    public static FollowedWork follow(UUID entityId, LocalDate followedAt) {
        if (entityId == null) {
            throw new IllegalArgumentException("Suivre une œuvre demande de la désigner");
        }
        return new FollowedWork(UUID.randomUUID(), entityId, null, followedAt == null ? LocalDate.now() : followedAt);
    }

    public static FollowedWork reconstitute(UUID id, UUID entityId, UUID ownerId, LocalDate followedAt) {
        return new FollowedWork(id, entityId, ownerId, followedAt);
    }

    public UUID id() {
        return id;
    }

    public UUID entityId() {
        return entityId;
    }

    public UUID ownerId() {
        return ownerId;
    }

    public LocalDate followedAt() {
        return followedAt;
    }
}
