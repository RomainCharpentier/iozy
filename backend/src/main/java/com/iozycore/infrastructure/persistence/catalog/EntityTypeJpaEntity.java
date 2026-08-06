package com.iozycore.infrastructure.persistence.catalog;

import jakarta.persistence.Column;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.util.List;
import java.util.UUID;

// Note : annotation @jakarta.persistence.Entity utilisée en forme qualifiée
// pour ne pas entrer en collision avec com.iozycore.domain.catalog.Entity
// (même convention que EntityJpaEntity dans ce package).
@jakarta.persistence.Entity
@Table(name = "entity_type")
public class EntityTypeJpaEntity {

    @Id
    private UUID id;

    @Column(nullable = false, unique = true)
    private String code;

    @Column(nullable = false)
    private String label;

    // Colonne "schema" JSONB déjà créée par V1__init_schema.sql, déjà
    // seedée pour les 3 types MVP avec exactement cette forme
    // {"customFieldKeys": [...], "allowedExperienceTypes": [...]}.
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private SchemaJson schema;

    public record SchemaJson(List<String> customFieldKeys, List<String> allowedExperienceTypes) {
    }

    protected EntityTypeJpaEntity() {
        // requis par JPA
    }

    public EntityTypeJpaEntity(UUID id, String code, String label, SchemaJson schema) {
        this.id = id;
        this.code = code;
        this.label = label;
        this.schema = schema;
    }

    public UUID getId() { return id; }
    public String getCode() { return code; }
    public String getLabel() { return label; }
    public SchemaJson getSchema() { return schema; }
}
