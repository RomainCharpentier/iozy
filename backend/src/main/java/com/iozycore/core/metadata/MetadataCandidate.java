package com.iozycore.core.metadata;

import java.util.Map;

/**
 * Résultat d'une recherche de métadonnées, déjà traduit dans un format
 * commun quelle que soit la source externe (Jikan, BGG...). C'est
 * l'anti-corruption layer du Bounded Context "Metadata Enrichment"
 * (étape 8 de la conception) : le reste de l'application ne connaît
 * jamais le format brut d'une API tierce.
 */
public record MetadataCandidate(
        String source,           // "JIKAN", "BGG"
        String externalId,       // identifiant chez la source externe
        String title,
        String imageUrl,         // peut être null si la source ne le fournit pas à ce stade
        Map<String, Object> attributes
) {
}
