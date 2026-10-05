package com.iozycore.manga.metadata;

import com.iozycore.core.domain.catalog.EntityType;

import java.util.List;

/**
 * Returns the titles of clearly DISTINCT series (spin-off, side story...)
 * of a series identified by its external id (e.g. malId) - never a
 * reissue/adaptation of the same work (see implementations: an
 * "alternative version"/"alternative setting" is left out on purpose,
 * it often means a real reissue that we want, on the contrary, to keep
 * as a volume search result).
 * <p>
 * Used to remove a spin-off published under a title structurally identical
 * to a real collection name (e.g. "Blue Lock - Episode Nagi - Tome 5",
 * impossible to tell apart from "Dragon Ball - Perfect Edition - Tome 5" without this
 * external information - see the history of the conversation, cases Tokyo
 * Ghoul:re/Blue Lock Episode Nagi/Demon Slayer School Days).
 */
public interface RelatedSeriesProvider {

    boolean supports(EntityType entityType);

    /** Best-effort: empty list if the id is unknown, if the call
     * fails, or if the series has no relation of this type. */
    List<String> findRelatedSeriesTitles(String externalId);
}
