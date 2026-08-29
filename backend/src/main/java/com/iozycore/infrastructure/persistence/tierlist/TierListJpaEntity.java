package com.iozycore.infrastructure.persistence.tierlist;

import jakarta.persistence.*;
import org.hibernate.annotations.TenantId;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "tier_list")
public class TierListJpaEntity {

    @Id
    private UUID id;

    // Cloisonnement par propriétaire : Hibernate ajoute cette colonne à la


    // clause WHERE de toute requête sur cette entité, et la remplit à


    // l'insertion depuis ProprietaireCourant. Un filtre qu'on ne peut pas


    // oublier, plutôt qu'une condition à réécrire dans chaque requête.


    @TenantId


    @Column(name = "owner_id", nullable = false)
    private UUID ownerId;

    @Column(nullable = false)
    private String name;

    /** Nullable depuis V13 : null = Tier List transverse "toutes catégories" (voir TierList). */
    @Column(name = "entity_type_id")
    private UUID entityTypeId;

    /** Rangs actifs, sérialisés en liste jointe par virgules (ex: "S,A,B") - voir TierListMapper. */
    @Column(name = "active_ranks", nullable = false, length = 32)
    private String activeRanks;

    private String description;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected TierListJpaEntity() {
    }

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

    public UUID getId() { return id; }
    public UUID getOwnerId() { return ownerId; }
    public String getName() { return name; }
    public UUID getEntityTypeId() { return entityTypeId; }
    public String getActiveRanks() { return activeRanks; }
    public String getDescription() { return description; }
    public Instant getCreatedAt() { return createdAt; }
}
