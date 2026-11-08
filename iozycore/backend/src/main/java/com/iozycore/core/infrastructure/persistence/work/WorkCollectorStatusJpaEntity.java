package com.iozycore.core.infrastructure.persistence.work;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.TenantId;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "work_collector_status")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Getter
public class WorkCollectorStatusJpaEntity {

    @Id
    private UUID id;

    @Column(name = "entity_id", nullable = false)
    private UUID entityId;

    // Isolation by owner, like a wish: Hibernate adds this column to every
    // query and fills it on insert (ProprietaireCourant).
    @TenantId
    @Column(name = "owner_id", nullable = false)
    private UUID ownerId;

    @Column(nullable = false)
    private String status;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    public WorkCollectorStatusJpaEntity(UUID id, UUID entityId, UUID ownerId, String status, Instant updatedAt) {
        this.id = id;
        this.entityId = entityId;
        this.ownerId = ownerId;
        this.status = status;
        this.updatedAt = updatedAt == null ? Instant.now() : updatedAt;
    }
}
