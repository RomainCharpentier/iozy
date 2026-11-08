package com.iozycore.boardgame.expansion;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Map;

/**
 * Durable store of the expansions of the base games (V43), shared by every
 * account: it is reference data, never a copy or a wish.
 */
public interface ExpansionCache {

    /** The stored rows of these base games, in one read; an empty list of ids reads nothing. */
    Map<String, StoredExpansions> findAll(Collection<String> baseBggIds);

    /** When each stored base game was last read, without the expansions. */
    Map<String, Instant> fetchedAtByBaseId();

    /** Replaces the row of this base game (upsert). */
    void save(String baseBggId, List<BoardGameExpansion> expansions, Instant fetchedAt);
}
