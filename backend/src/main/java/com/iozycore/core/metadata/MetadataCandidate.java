package com.iozycore.core.metadata;

import java.util.Map;

/**
 * Result of a metadata search, already translated into a common
 * format whatever the external source (Jikan, BGG...). This is
 * the anti-corruption layer of the "Metadata Enrichment" Bounded Context
 * (step 8 of the design): the rest of the application never knows
 * the raw format of a third-party API.
 * <p>
 * {@code title} always names the WORK (the series), never one volume. A
 * source that describes one precise volume (a book found by its ISBN) says
 * which one in {@code volume}; for every other candidate it is {@code null}.
 */
public record MetadataCandidate(
        String source,           // "JIKAN", "BGG"
        String externalId,       // identifier at the external source
        String title,
        String imageUrl,         // can be null if the source does not provide it at this stage
        Map<String, Object> attributes,
        Volume volume            // null when the candidate describes the whole work
) {

    /** A candidate for a whole work: no volume. */
    public MetadataCandidate(String source, String externalId, String title, String imageUrl,
                             Map<String, Object> attributes) {
        this(source, externalId, title, imageUrl, attributes, null);
    }

    /**
     * The volume a candidate describes, as the source gives it.
     * <p>
     * Kept apart from {@code attributes} on purpose: the attributes describe
     * the work and are copied onto its catalog page. A volume number there
     * would end up on the series.
     *
     * @param sourceTitle the title as the source writes it ("One Piece - Édition originale Tome 01")
     * @param number      the volume number read in that title, or {@code null}
     * @param edition     the edition named in that title ("Édition originale"), or {@code null}
     */
    public record Volume(String sourceTitle, Integer number, String edition) {
    }
}
