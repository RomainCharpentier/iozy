package com.iozycore.infrastructure.persistence.wishlist;

import jakarta.persistence.*;

import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "wishlist_entry")
public class WishlistEntryJpaEntity {

    @Id
    private UUID id;

    @Column(name = "entity_id", nullable = false, unique = true)
    private UUID entityId;

    @Column(name = "owner_id", nullable = false)
    private UUID ownerId;

    @Column(name = "added_at", nullable = false)
    private LocalDate addedAt;

    protected WishlistEntryJpaEntity() {
    }

    public WishlistEntryJpaEntity(UUID id, UUID entityId, UUID ownerId, LocalDate addedAt) {
        this.id = id;
        this.entityId = entityId;
        this.ownerId = ownerId;
        this.addedAt = addedAt;
    }

    public UUID getId() { return id; }
    public UUID getEntityId() { return entityId; }
    public UUID getOwnerId() { return ownerId; }
    public LocalDate getAddedAt() { return addedAt; }
}
