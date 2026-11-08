package com.iozycore.core.domain.work;

import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

/**
 * The collector status one account gives to one work. Private to the account,
 * like a wish: the owner is set by the persistence from the session.
 * No status stored means {@link CollectorStatus#ONGOING}.
 */
public final class WorkCollectorStatus {

    private final UUID id;
    private final UUID entityId;
    private final UUID ownerId;
    private final CollectorStatus status;
    private final Instant updatedAt;

    private WorkCollectorStatus(UUID id, UUID entityId, UUID ownerId, CollectorStatus status, Instant updatedAt) {
        this.id = Objects.requireNonNull(id, "id");
        this.entityId = Objects.requireNonNull(entityId, "entityId");
        this.ownerId = ownerId;
        this.status = Objects.requireNonNull(status, "status");
        this.updatedAt = updatedAt;
    }

    public static WorkCollectorStatus create(UUID entityId, CollectorStatus status, Instant now) {
        return new WorkCollectorStatus(UUID.randomUUID(), entityId, null, status, now);
    }

    public static WorkCollectorStatus reconstitute(UUID id, UUID entityId, UUID ownerId, CollectorStatus status,
                                                   Instant updatedAt) {
        return new WorkCollectorStatus(id, entityId, ownerId, status, updatedAt);
    }

    /** The same row with a new status: one status per work and account. */
    public WorkCollectorStatus changeTo(CollectorStatus newStatus, Instant now) {
        return new WorkCollectorStatus(id, entityId, ownerId, newStatus, now);
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

    public CollectorStatus status() {
        return status;
    }

    public Instant updatedAt() {
        return updatedAt;
    }
}
