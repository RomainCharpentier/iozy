package com.iozycore.core.infrastructure.persistence.tierlist;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.TenantId;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "tier_list")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Getter
public class TierListJpaEntity {

    @Id
    private UUID id;

    // Isolation by owner: Hibernate adds this column to the

    // WHERE clause of every query on this entity, and fills it on

    // insert from ProprietaireCourant. A filter you cannot

    // forget, instead of a condition to rewrite in every query.

    @TenantId

    @Column(name = "owner_id", nullable = false)
    private UUID ownerId;

    @Column(nullable = false)
    private String name;

    /** Nullable since V13: null = cross-type Tier List "all categories" (see TierList). */
    @Column(name = "entity_type_id")
    private UUID entityTypeId;

    /** Active ranks, serialized as a comma-joined list (e.g. "S,A,B") - see TierListMapper. */
    @Column(name = "active_ranks", nullable = false, length = 32)
    private String activeRanks;

    private String description;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    public TierListJpaEntity(UUID id, UUID ownerId, String name, UUID entityTypeId, String activeRanks,
                              String description, Instant createdAt) {
        this.id = id;
        this.ownerId = ownerId;
        this.name = name;
        this.entityTypeId = entityTypeId;
        this.activeRanks = activeRanks;
        this.description = description;
        this.createdAt = createdAt;
    }
}
