package com.iozycore.core.infrastructure.persistence.experience;

import jakarta.persistence.*;
import org.hibernate.annotations.TenantId;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "experience")
public class ExperienceJpaEntity {

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

    @Column(name = "experience_type", nullable = false)
    private String experienceType;

    @Column(name = "occurred_at", nullable = false)
    private LocalDate occurredAt;

    // The Integer type is enough on the Java side (same bounds as the SQL CHECK 0-10);
    // @JdbcTypeCode forces the JDBC type used by Hibernate for
    // schema validation (ddl-auto=validate) to SMALLINT, which is the
    // real type of the column created by migration V1. columnDefinition alone
    // is not enough: it only drives DDL generation, not validation.
    @JdbcTypeCode(SqlTypes.SMALLINT)
    private Integer rating;

    private String comment;

    protected ExperienceJpaEntity() {
    }

    public ExperienceJpaEntity(UUID id, UUID entityId, UUID variantId, UUID ownerId, String experienceType,
                                LocalDate occurredAt, Integer rating, String comment) {
        this.id = id;
        this.entityId = entityId;
        this.variantId = variantId;
        this.ownerId = ownerId;
        this.experienceType = experienceType;
        this.occurredAt = occurredAt;
        this.rating = rating;
        this.comment = comment;
    }

    public UUID getId() { return id; }
    public UUID getEntityId() { return entityId; }
    public UUID getVariantId() { return variantId; }
    public UUID getOwnerId() { return ownerId; }
    public String getExperienceType() { return experienceType; }
    public LocalDate getOccurredAt() { return occurredAt; }
    public Integer getRating() { return rating; }
    public String getComment() { return comment; }
}
