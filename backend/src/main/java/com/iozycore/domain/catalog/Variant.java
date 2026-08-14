package com.iozycore.domain.catalog;

import java.util.Map;
import java.util.UUID;

/**
 * Variante optionnelle d'une Entity (ex: "Perfect Edition", "Tome 3").
 * N'a de sens qu'à l'intérieur de son Entity — jamais manipulée seule.
 * <p>
 * {@code mangaEditionId} relie ce Tome à son Édition catalogue
 * ({@link MangaEdition}) quand elle est connue - nullable et additif (modèle
 * cible Série -> Édition -> Tome). L'attribut libre {@code "edition"} dans
 * {@code attributes} reste le mécanisme de résolution texte existant (voir
 * {@code SeriesMatcher} côté purchase-analysis / {@code groupVariantsByEdition}
 * côté web) ; {@code mangaEditionId} est la relation structurée cible, peuplée
 * seulement une fois réellement résolue, jamais devinée - voir
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
