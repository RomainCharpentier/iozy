package com.iozycore.infrastructure.persistence.tierlist;

import jakarta.persistence.*;
import org.hibernate.annotations.TenantId;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "tier_list_item")
public class TierListItemJpaEntity {

    @Id
    private UUID id;

    // Cloisonnement par propriétaire (V26) : Hibernate ajoute cette colonne
    // à la clause WHERE de toute requête sur cette entité, et la remplit à
    // l'insertion depuis ProprietaireCourant.
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

    protected TierListItemJpaEntity() {
    }

    public TierListItemJpaEntity(UUID id, UUID tierListId, UUID entityId, String rank, Instant addedAt) {
        this.id = id;
        this.tierListId = tierListId;
        this.entityId = entityId;
        this.rank = rank;
        this.addedAt = addedAt;
    }

    public UUID getId() { return id; }
    public UUID getTierListId() { return tierListId; }
    public UUID getEntityId() { return entityId; }
    public String getRank() { return rank; }
    public Instant getAddedAt() { return addedAt; }
}
