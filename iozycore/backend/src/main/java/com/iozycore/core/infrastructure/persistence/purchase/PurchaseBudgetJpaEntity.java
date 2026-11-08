package com.iozycore.core.infrastructure.persistence.purchase;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.TenantId;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "purchase_budget")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Getter
public class PurchaseBudgetJpaEntity {

    @Id
    private UUID id;

    // Isolation by owner: Hibernate adds this column to every query and fills
    // it on insert (ProprietaireCourant).
    @TenantId
    @Column(name = "owner_id", nullable = false)
    private UUID ownerId;

    @Column(name = "monthly_amount", nullable = false, precision = 10, scale = 2)
    private BigDecimal monthlyAmount;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
}
