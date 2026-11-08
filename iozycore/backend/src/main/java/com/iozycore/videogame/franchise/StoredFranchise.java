package com.iozycore.videogame.franchise;

import java.time.Instant;

/** The licence of one game, as last read from IGDB. */
public record StoredFranchise(String igdbId, Franchise franchise, Instant fetchedAt) {
}
