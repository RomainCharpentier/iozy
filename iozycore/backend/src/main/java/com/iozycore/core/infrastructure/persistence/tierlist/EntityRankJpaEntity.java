package com.iozycore.core.infrastructure.persistence.tierlist;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.TenantId;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "entity_rank")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Getter
public class EntityRankJpaEntity {

    @Id
    @Column(name = "entity_id")
    private UUID entityId;

    // Isolation by owner: Hibernate adds this column to the

    // WHERE clause of every query on this entity, and fills it on

    // insert from ProprietaireCourant. A filter you cannot

    // forget, instead of a condition to rewrite in every query.

    @TenantId

    @Column(name = "owner_id", nullable = false)
    private UUID ownerId;

    @Column(nullable = false, length = 1)
    private String rank;

    @Column(name = "ranked_at", nullable = false)
    private Instant rankedAt;

    public EntityRankJpaEntity(UUID entityId, UUID ownerId, String rank, Instant rankedAt) {
        this.entityId = entityId;
        this.ownerId = ownerId;
        this.rank = rank;
        this.rankedAt = rankedAt;
    }
}
