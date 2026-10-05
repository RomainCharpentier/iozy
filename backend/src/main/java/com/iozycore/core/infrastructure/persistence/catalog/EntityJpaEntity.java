package com.iozycore.core.infrastructure.persistence.catalog;

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
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

// Note: annotation @jakarta.persistence.Entity used in qualified form
// to avoid a collision with com.iozycore.core.domain.catalog.Entity.
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

    /** The attribute keys typed by hand (V32, Batch 130). */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "manual_attribute_keys", columnDefinition = "jsonb", nullable = false)
    private List<String> manualAttributeKeys = new ArrayList<>();

    // Table entity_tag(entity_id, tag_id) already created by V1__init_schema.sql
    //
    // @BatchSize: with EAGER alone, Hibernate loaded the tags of ONE work per
    // query - measured at 7 entity_tag queries to list 6 works, on the
    // busiest path of the app (My collection, export, progress...).
    // With a batch of 100, the same list fits in one query, and a collection
    // of 500 series in five instead of five hundred.
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
        // required by JPA
    }

    public EntityJpaEntity(UUID id, UUID entityTypeId, String title, Map<String, Object> attributes,
                            Set<String> manualAttributeKeys, Set<UUID> tagIds, Instant createdAt, Instant updatedAt) {
        this.id = id;
        this.entityTypeId = entityTypeId;
        this.title = title;
        this.attributes = attributes;
        this.manualAttributeKeys = manualAttributeKeys != null ? new ArrayList<>(manualAttributeKeys) : new ArrayList<>();
        this.tagIds = tagIds != null ? new HashSet<>(tagIds) : new HashSet<>();
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
    }

    public UUID getId() { return id; }
    public UUID getEntityTypeId() { return entityTypeId; }
    public String getTitle() { return title; }
    public Map<String, Object> getAttributes() { return attributes; }
    public List<String> getManualAttributeKeys() { return manualAttributeKeys != null ? manualAttributeKeys : List.of(); }
    public Set<UUID> getTagIds() { return tagIds; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}
