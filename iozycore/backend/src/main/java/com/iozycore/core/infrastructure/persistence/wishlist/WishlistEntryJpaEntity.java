package com.iozycore.core.infrastructure.persistence.wishlist;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.TenantId;

import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "wishlist_entry")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Getter
public class WishlistEntryJpaEntity {

    @Id
    private UUID id;

    // No more `unique` here: the uniqueness goes down to the pair (work, volume) and is
    // held by two partial indexes on the database side (see V21), because two NULLs
    // are never equal in SQL and an ordinary constraint would let through
    // as many work wishes as you like.
    @Column(name = "entity_id", nullable = false)
    private UUID entityId;

    /** The wanted volume. Empty for a type with no notion of volume, where the work is
     *  itself the collectible object. */
    @Column(name = "variant_id")
    private UUID variantId;

    // Isolation by owner: Hibernate adds this column to the
    // WHERE clause of every query on this entity, and fills it on
    // insert from ProprietaireCourant. A filter you cannot
    // forget, instead of a condition to rewrite in every query.
    @TenantId
    @Column(name = "owner_id", nullable = false)
    private UUID ownerId;

    @Column(name = "added_at", nullable = false)
    private LocalDate addedAt;

    public WishlistEntryJpaEntity(UUID id, UUID entityId, UUID variantId, UUID ownerId, LocalDate addedAt) {
        this.id = id;
        this.entityId = entityId;
        this.variantId = variantId;
        this.ownerId = ownerId;
        this.addedAt = addedAt;
    }
}
