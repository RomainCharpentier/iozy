package com.iozycore.core.infrastructure.persistence.follow;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.TenantId;

import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "followed_work")
public class FollowedWorkJpaEntity {

    @Id
    private UUID id;

    @Column(name = "entity_id", nullable = false)
    private UUID entityId;

    // Cloisonnement par propriétaire, comme une envie : Hibernate ajoute cette
    // colonne à toute requête et la remplit à l'insertion (ProprietaireCourant).
    @TenantId
    @Column(name = "owner_id", nullable = false)
    private UUID ownerId;

    @Column(name = "followed_at", nullable = false)
    private LocalDate followedAt;

    protected FollowedWorkJpaEntity() {
    }

    public FollowedWorkJpaEntity(UUID id, UUID entityId, UUID ownerId, LocalDate followedAt) {
        this.id = id;
        this.entityId = entityId;
        this.ownerId = ownerId;
        this.followedAt = followedAt;
    }

    public UUID getId() { return id; }
    public UUID getEntityId() { return entityId; }
    public UUID getOwnerId() { return ownerId; }
    public LocalDate getFollowedAt() { return followedAt; }
}
