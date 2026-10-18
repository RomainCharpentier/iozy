package com.iozycore.core.infrastructure.persistence.catalog;

import jakarta.persistence.Column;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.util.List;
import java.util.UUID;

// Note: annotation @jakarta.persistence.Entity used in qualified form
// to avoid a collision with com.iozycore.core.domain.catalog.Entity
// (same convention as EntityJpaEntity in this package).
@jakarta.persistence.Entity
@Table(name = "entity_type")
public class EntityTypeJpaEntity {

    @Id
    private UUID id;

    @Column(nullable = false, unique = true)
    private String code;

    @Column(nullable = false)
    private String label;

    // "schema" JSONB column already created by V1__init_schema.sql, already
    // seeded for the 3 MVP types with exactly this shape
    // {"customFieldKeys": [...], "allowedExperienceTypes": [...]}.
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private SchemaJson schema;

    public record SchemaJson(List<String> customFieldKeys, List<String> allowedExperienceTypes) {
    }

    /** Chosen visual identity (V15) - nullable: NULL = default visual
     * on the client side. Keys, never colors (see EntityType). */
    @Column(name = "color_key")
    private String colorKey;

    @Column(name = "icon_key")
    private String iconKey;

    @Column(name = "aspect_key")
    private String aspectKey;

    protected EntityTypeJpaEntity() {
        // required by JPA
    }

    public EntityTypeJpaEntity(UUID id, String code, String label, SchemaJson schema) {
        this(id, code, label, schema, null, null, null);
    }

    public EntityTypeJpaEntity(UUID id, String code, String label, SchemaJson schema, String colorKey, String iconKey,
                                String aspectKey) {
        this.id = id;
        this.code = code;
        this.label = label;
        this.schema = schema;
        this.colorKey = colorKey;
        this.iconKey = iconKey;
        this.aspectKey = aspectKey;
    }

    public UUID getId() { return id; }
    public String getCode() { return code; }
    public String getLabel() { return label; }
    public SchemaJson getSchema() { return schema; }
    public String getColorKey() { return colorKey; }
    public String getIconKey() { return iconKey; }
    public String getAspectKey() { return aspectKey; }
}
