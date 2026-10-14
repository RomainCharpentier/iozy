package com.iozycore.core.infrastructure.persistence.ownership;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.TenantId;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "ownership")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Getter
public class OwnershipJpaEntity {

    @Id
    private UUID id;

    @Column(name = "entity_id", nullable = false)
    private UUID entityId;

    @Column(name = "variant_id")
    private UUID variantId;

    // Isolation by owner: Hibernate adds this column to the
    // WHERE clause of every query on this entity, and fills it on
    // insert from ProprietaireCourant. A filter you cannot
    // forget, instead of a condition to rewrite in every query.
    @TenantId
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
}
