package com.iozycore.infrastructure.persistence.tierlist;

import jakarta.persistence.*;
import org.hibernate.annotations.TenantId;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "entity_rank")
public class EntityRankJpaEntity {

    @Id
    @Column(name = "entity_id")
    private UUID entityId;

    // Cloisonnement par propriétaire : Hibernate ajoute cette colonne à la


    // clause WHERE de toute requête sur cette entité, et la remplit à


    // l'insertion depuis ProprietaireCourant. Un filtre qu'on ne peut pas


    // oublier, plutôt qu'une condition à réécrire dans chaque requête.


    @TenantId


    @Column(name = "owner_id", nullable = false)
    private UUID ownerId;

    @Column(nullable = false, length = 1)
    private String rank;

    @Column(name = "ranked_at", nullable = false)
    private Instant rankedAt;

    protected EntityRankJpaEntity() {
    }

    public EntityRankJpaEntity(UUID entityId, UUID ownerId, String rank, Instant rankedAt) {
        this.entityId = entityId;
        this.ownerId = ownerId;
        this.rank = rank;
        this.rankedAt = rankedAt;
    }

    public UUID getEntityId() { return entityId; }
    public UUID getOwnerId() { return ownerId; }
    public String getRank() { return rank; }
    public Instant getRankedAt() { return rankedAt; }
}
