package com.iozycore.core.infrastructure.persistence.tierlist;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.TenantId;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "tier_list_item")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Getter
public class TierListItemJpaEntity {

    @Id
    private UUID id;

    // Isolation by owner (V26): Hibernate adds this column
    // to the WHERE clause of every query on this entity, and fills it on
    // insert from ProprietaireCourant.
    @TenantId
    @Column(name = "owner_id", nullable = false)
    private UUID ownerId;

    @Column(name = "tier_list_id", nullable = false)
    private UUID tierListId;

    @Column(name = "entity_id", nullable = false)
    private UUID entityId;

    @Column(length = 1)
    private String rank;

    @Column(name = "added_at", nullable = false)
    private Instant addedAt;

    public TierListItemJpaEntity(UUID id, UUID tierListId, UUID entityId, String rank, Instant addedAt) {
        this.id = id;
        this.tierListId = tierListId;
        this.entityId = entityId;
        this.rank = rank;
        this.addedAt = addedAt;
    }
}
