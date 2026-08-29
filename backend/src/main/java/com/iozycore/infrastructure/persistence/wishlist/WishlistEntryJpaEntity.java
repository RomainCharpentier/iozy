package com.iozycore.infrastructure.persistence.wishlist;

import jakarta.persistence.*;
import org.hibernate.annotations.TenantId;

import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "wishlist_entry")
public class WishlistEntryJpaEntity {

    @Id
    private UUID id;

    // Plus d'`unique` ici : l'unicité descend au couple (œuvre, tome) et se
    // tient par deux index partiels côté base (voir V21), parce que deux NULL
    // ne sont jamais égaux en SQL et qu'une contrainte ordinaire laisserait
    // passer autant d'envies d'œuvre qu'on voudrait.
    @Column(name = "entity_id", nullable = false)
    private UUID entityId;

    /** Le tome voulu. Vide pour un type sans notion de tome, où l'œuvre est
     *  elle-même l'objet collectionnable. */
    @Column(name = "variant_id")
    private UUID variantId;

    // Cloisonnement par propriétaire : Hibernate ajoute cette colonne à la
    // clause WHERE de toute requête sur cette entité, et la remplit à
    // l'insertion depuis ProprietaireCourant. Un filtre qu'on ne peut pas
    // oublier, plutôt qu'une condition à réécrire dans chaque requête.
    @TenantId
    @Column(name = "owner_id", nullable = false)
    private UUID ownerId;

    @Column(name = "added_at", nullable = false)
    private LocalDate addedAt;

    protected WishlistEntryJpaEntity() {
    }

    public WishlistEntryJpaEntity(UUID id, UUID entityId, UUID variantId, UUID ownerId, LocalDate addedAt) {
        this.id = id;
        this.entityId = entityId;
        this.variantId = variantId;
        this.ownerId = ownerId;
        this.addedAt = addedAt;
    }

    public UUID getId() { return id; }
    public UUID getEntityId() { return entityId; }
    public UUID getVariantId() { return variantId; }
    public UUID getOwnerId() { return ownerId; }
    public LocalDate getAddedAt() { return addedAt; }
}
