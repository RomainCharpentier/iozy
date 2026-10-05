package com.iozycore.core.metadata;

import java.util.Map;

/**
 * Result of a metadata search, already translated into a common
 * format whatever the external source (Jikan, BGG...). This is
 * the anti-corruption layer of the "Metadata Enrichment" Bounded Context
 * (step 8 of the design): the rest of the application never knows
 * the raw format of a third-party API.
 */
public record MetadataCandidate(
        String source,           // "JIKAN", "BGG"
        String externalId,       // identifier at the external source
        String title,
        String imageUrl,         // can be null if the source does not provide it at this stage
        Map<String, Object> attributes
) {
}
