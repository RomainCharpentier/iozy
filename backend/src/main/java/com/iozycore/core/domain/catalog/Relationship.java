package com.iozycore.core.domain.catalog;

import java.util.UUID;

/**
 * Typed link between two Entity (e.g. ADAPTED_INTO, PART_OF_SERIES).
 * The relationship type stays a free string to stay configurable
 * without code changes, following the genericity principle.
 */
public record Relationship(
        UUID id,
        UUID sourceEntityId,
        UUID targetEntityId,
        String relationshipType
) {
    public Relationship {
        // Before these two guards, an incomplete request body reached the
        // .equals() below and raised a NullPointerException as a 500
        // ("Cannot invoke java.util.UUID.equals(Object)") - see Batch 28.
        if (sourceEntityId == null) {
            throw new IllegalArgumentException("Une relation doit avoir une Entity source");
        }
        if (targetEntityId == null) {
            throw new IllegalArgumentException("Une relation doit avoir une Entity cible");
        }
        if (sourceEntityId.equals(targetEntityId)) {
            throw new IllegalArgumentException("Une Entity ne peut pas être en relation avec elle-même");
        }
        if (relationshipType == null || relationshipType.isBlank()) {
            throw new IllegalArgumentException("Le type de relation ne peut pas être vide");
        }
    }
}
