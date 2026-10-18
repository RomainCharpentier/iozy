package com.iozycore.core.domain.catalog;

import java.util.Map;
import java.util.UUID;

/**
 * Optional variant of an Entity (e.g. "Perfect Edition", "Tome 3").
 * Only makes sense inside its Entity - never handled alone.
 * <p>
 * {@code mangaEditionId} links this Volume to its catalog Edition
 * ({@link MangaEdition}) when it is known - nullable and additive (target
 * model Series -> Edition -> Volume). The free attribute {@code "edition"} in
 * {@code attributes} stays the existing text resolution mechanism (see
 * {@code SeriesMatcher} on the purchase-analysis side / {@code groupVariantsByEdition}
 * on the web side); {@code mangaEditionId} is the target structured relation, filled
 * only once really resolved, never guessed - see
 * {@link Entity#linkVariantToEdition(UUID, UUID)}.
 */
public record Variant(
        UUID id,
        String label,
        Map<String, Object> attributes,
        UUID mangaEditionId
) {
    public Variant {
        if (label == null || label.isBlank()) {
            throw new IllegalArgumentException("Le label d'un Variant ne peut pas être vide");
        }
        attributes = attributes == null ? Map.of() : Map.copyOf(attributes);
    }
}
