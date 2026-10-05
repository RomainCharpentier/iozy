package com.iozycore.manga.infrastructure.followededition;

import jakarta.persistence.*;
import org.hibernate.annotations.TenantId;

import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "followed_edition")
public class FollowedEditionJpaEntity {

    @Id
    private UUID id;

    @Column(name = "entity_id", nullable = false)
    private UUID entityId;

    // Separation by owner: Hibernate adds this column to the


    // WHERE clause of every query on this entity, and fills it in at


    // insert time from ProprietaireCourant. A filter that cannot be


    // forgotten, rather than a condition to rewrite in every query.


    @TenantId


    @Column(name = "owner_id", nullable = false)
    private UUID ownerId;

    @Column(name = "edition_name", nullable = false)
    private String editionName;

    @Column(name = "followed_at", nullable = false)
    private LocalDate followedAt;

    protected FollowedEditionJpaEntity() {
    }

    public FollowedEditionJpaEntity(UUID id, UUID entityId, UUID ownerId, String editionName, LocalDate followedAt) {
        this.id = id;
        this.entityId = entityId;
        this.ownerId = ownerId;
        this.editionName = editionName;
        this.followedAt = followedAt;
    }

    public UUID getId() { return id; }
    public UUID getEntityId() { return entityId; }
    public UUID getOwnerId() { return ownerId; }
    public String getEditionName() { return editionName; }
    public LocalDate getFollowedAt() { return followedAt; }
}
