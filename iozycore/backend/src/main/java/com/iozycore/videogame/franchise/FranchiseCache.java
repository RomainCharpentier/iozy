package com.iozycore.videogame.franchise;

import java.time.Instant;
import java.util.Collection;
import java.util.Map;

/** Durable store of the licences of the video games (V43), shared by every account. */
public interface FranchiseCache {

    /** The stored rows of these games, in one read; an empty list of ids reads nothing. */
    Map<String, StoredFranchise> findAll(Collection<String> igdbIds);

    /** When each stored game was last read, without its licence. */
    Map<String, Instant> fetchedAtById();

    /** Replaces the row of this game (upsert). */
    void save(String igdbId, Franchise franchise, Instant fetchedAt);
}
