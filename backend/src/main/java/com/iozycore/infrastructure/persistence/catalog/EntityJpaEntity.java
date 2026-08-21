package com.iozycore.infrastructure.persistence.catalog;

import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.Table;
import org.hibernate.annotations.BatchSize;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

// Note : annotation @jakarta.persistence.Entity utilisée en forme qualifiée
// pour ne pas entrer en collision avec com.iozycore.domain.catalog.Entity.
@jakarta.persistence.Entity
@Table(name = "entity")
public class EntityJpaEntity {

    @Id
    private UUID id;

    @Column(name = "entity_type_id", nullable = false)
    private UUID entityTypeId;

    @Column(nullable = false)
    private String title;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private Map<String, Object> attributes;

    // Table entity_tag(entity_id, tag_id) déjà créée par V1__init_schema.sql
    //
    // @BatchSize : en EAGER seul, Hibernate chargeait les tags d'UNE œuvre par
    // requête - mesuré à 7 requêtes entity_tag pour lister 6 œuvres, sur le
    // chemin le plus fréquenté de l'app (Ma collection, export, progression...).
    // Avec un lot de 100, la même liste tient en une requête, et une collection
    // de 500 séries en cinq au lieu de cinq cents.
    @BatchSize(size = 100)
    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "entity_tag", joinColumns = @JoinColumn(name = "entity_id"))
    @Column(name = "tag_id")
    private Set<UUID> tagIds = new HashSet<>();

    @Column(name = "created_at")
    private Instant createdAt;

    @Column(name = "updated_at")
    private Instant updatedAt;

    protected EntityJpaEntity() {
        // requis par JPA
    }

    public EntityJpaEntity(UUID id, UUID entityTypeId, String title, Map<String, Object> attributes,
                            Set<UUID> tagIds, Instant createdAt, Instant updatedAt) {
        this.id = id;
        this.entityTypeId = entityTypeId;
        this.title = title;
        this.attributes = attributes;
        this.tagIds = tagIds != null ? new HashSet<>(tagIds) : new HashSet<>();
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
    }

    public UUID getId() { return id; }
    public UUID getEntityTypeId() { return entityTypeId; }
    public String getTitle() { return title; }
    public Map<String, Object> getAttributes() { return attributes; }
    public Set<UUID> getTagIds() { return tagIds; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}
