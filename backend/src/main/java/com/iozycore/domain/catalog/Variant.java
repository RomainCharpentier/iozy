package com.iozycore.domain.catalog;

import java.util.Map;
import java.util.UUID;

/**
 * Variante optionnelle d'une Entity (ex: "Perfect Edition", "Tome 3").
 * N'a de sens qu'à l'intérieur de son Entity — jamais manipulée seule.
 */
public record Variant(
        UUID id,
        String label,
        Map<String, Object> attributes
) {
    public Variant {
        if (label == null || label.isBlank()) {
            throw new IllegalArgumentException("Le label d'un Variant ne peut pas être vide");
        }
        attributes = attributes == null ? Map.of() : Map.copyOf(attributes);
    }
}
