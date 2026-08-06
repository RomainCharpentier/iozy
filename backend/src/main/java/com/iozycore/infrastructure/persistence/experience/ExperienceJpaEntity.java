package com.iozycore.infrastructure.persistence.experience;

import jakarta.persistence.*;

import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "experience")
public class ExperienceJpaEntity {

    @Id
    private UUID id;

    @Column(name = "entity_id", nullable = false)
    private UUID entityId;

    @Column(name = "owner_id", nullable = false)
    private UUID ownerId;

    @Column(name = "experience_type", nullable = false)
    private String experienceType;

    @Column(name = "occurred_at", nullable = false)
    private LocalDate occurredAt;

    private Integer rating;

    private String comment;

    protected ExperienceJpaEntity() {
    }

    public ExperienceJpaEntity(UUID id, UUID entityId, UUID ownerId, String experienceType, LocalDate occurredAt,
                                Integer rating, String comment) {
        this.id = id;
        this.entityId = entityId;
        this.ownerId = ownerId;
        this.experienceType = experienceType;
        this.occurredAt = occurredAt;
        this.rating = rating;
        this.comment = comment;
    }

    public UUID getId() { return id; }
    public UUID getEntityId() { return entityId; }
    public UUID getOwnerId() { return ownerId; }
    public String getExperienceType() { return experienceType; }
    public LocalDate getOccurredAt() { return occurredAt; }
    public Integer getRating() { return rating; }
    public String getComment() { return comment; }
}
