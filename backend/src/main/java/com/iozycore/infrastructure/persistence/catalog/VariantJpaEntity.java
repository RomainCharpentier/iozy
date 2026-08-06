package com.iozycore.infrastructure.persistence.catalog;

import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.util.Map;
import java.util.UUID;

@Entity
@Table(name = "variant")
public class VariantJpaEntity {

    @Id
    private UUID id;

    @Column(name = "entity_id", nullable = false)
    private UUID entityId;

    @Column(nullable = false)
    private String label;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private Map<String, Object> attributes;

    protected VariantJpaEntity() {
        // requis par JPA
    }

    public VariantJpaEntity(UUID id, UUID entityId, String label, Map<String, Object> attributes) {
        this.id = id;
        this.entityId = entityId;
        this.label = label;
        this.attributes = attributes;
    }

    public UUID getId() { return id; }
    public UUID getEntityId() { return entityId; }
    public String getLabel() { return label; }
    public Map<String, Object> getAttributes() { return attributes; }
}
