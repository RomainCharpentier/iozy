package com.iozycore.infrastructure.persistence.experience;

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

    // Cloisonnement par propriétaire : Hibernate ajoute cette colonne à la
    // clause WHERE de toute requête sur cette entité, et la remplit à
    // l'insertion depuis ProprietaireCourant. Un filtre qu'on ne peut pas
    // oublier, plutôt qu'une condition à réécrire dans chaque requête.
    @TenantId
    @Column(name = "owner_id", nullable = false)
    private UUID ownerId;

    @Column(name = "experience_type", nullable = false)
    private String experienceType;

    @Column(name = "occurred_at", nullable = false)
    private LocalDate occurredAt;

    // Le type Integer suffit côté Java (mêmes bornes que le CHECK SQL 0-10) ;
    // @JdbcTypeCode force le type JDBC utilisé par Hibernate pour la
    // validation de schéma (ddl-auto=validate) à SMALLINT, qui est le type
    // réel de la colonne créée par la migration V1. columnDefinition seul
    // ne suffit pas : il ne pilote que la génération DDL, pas la validation.
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
