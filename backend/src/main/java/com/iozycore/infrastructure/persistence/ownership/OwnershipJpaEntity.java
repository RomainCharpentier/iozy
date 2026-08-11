package com.iozycore.infrastructure.persistence.ownership;

import jakarta.persistence.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "ownership")
public class OwnershipJpaEntity {

    @Id
    private UUID id;

    @Column(name = "entity_id", nullable = false)
    private UUID entityId;

    @Column(name = "variant_id")
    private UUID variantId;

    @Column(name = "owner_id", nullable = false)
    private UUID ownerId;

    @Column(nullable = false)
    private String condition;

    @Column(nullable = false)
    private String status;

    @Column(name = "acquired_at", nullable = false)
    private LocalDate acquiredAt;

    private String note;

    @Column(name = "purchase_price")
    private BigDecimal purchasePrice;

    protected OwnershipJpaEntity() {
    }

    public OwnershipJpaEntity(UUID id, UUID entityId, UUID variantId, UUID ownerId, String condition,
                               String status, LocalDate acquiredAt, String note, BigDecimal purchasePrice) {
        this.id = id;
        this.entityId = entityId;
        this.variantId = variantId;
        this.ownerId = ownerId;
        this.condition = condition;
        this.status = status;
        this.acquiredAt = acquiredAt;
        this.note = note;
        this.purchasePrice = purchasePrice;
    }

    public UUID getId() { return id; }
    public UUID getEntityId() { return entityId; }
    public UUID getVariantId() { return variantId; }
    public UUID getOwnerId() { return ownerId; }
    public String getCondition() { return condition; }
    public String getStatus() { return status; }
    public LocalDate getAcquiredAt() { return acquiredAt; }
    public String getNote() { return note; }
    public BigDecimal getPurchasePrice() { return purchasePrice; }
}
