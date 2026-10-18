package com.iozycore.core.infrastructure.persistence.follow;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.TenantId;

import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "followed_work")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Getter
public class FollowedWorkJpaEntity {

    @Id
    private UUID id;

    @Column(name = "entity_id", nullable = false)
    private UUID entityId;

    // Isolation by owner, like a wish: Hibernate adds this
    // column to every query and fills it on insert (ProprietaireCourant).
    @TenantId
    @Column(name = "owner_id", nullable = false)
    private UUID ownerId;

    @Column(name = "followed_at", nullable = false)
    private LocalDate followedAt;

    public FollowedWorkJpaEntity(UUID id, UUID entityId, UUID ownerId, LocalDate followedAt) {
        this.id = id;
        this.entityId = entityId;
        this.ownerId = ownerId;
        this.followedAt = followedAt;
    }
}
