package com.iozycore.domain.catalog;

import java.util.UUID;

/**
 * Lien typé entre deux Entity (ex: ADAPTED_INTO, PART_OF_SERIES).
 * Le type de relation reste une chaîne libre pour rester configurable
 * sans modification du code, conformément au principe de généricité.
 */
public record Relationship(
        UUID id,
        UUID sourceEntityId,
        UUID targetEntityId,
        String relationshipType
) {
    public Relationship {
        if (sourceEntityId.equals(targetEntityId)) {
            throw new IllegalArgumentException("Une Entity ne peut pas être en relation avec elle-même");
        }
        if (relationshipType == null || relationshipType.isBlank()) {
            throw new IllegalArgumentException("Le type de relation ne peut pas être vide");
        }
    }
}
