package com.iozycore.boardgame.expansion;

import java.time.Instant;
import java.util.List;

/**
 * The expansions of one base game, as last read from BoardGameGeek.
 *
 * @param baseBggId  the BGG id of the base game
 * @param expansions in BGG order; empty when BGG answered and knows none
 * @param fetchedAt  when BGG answered
 */
public record StoredExpansions(String baseBggId, List<BoardGameExpansion> expansions, Instant fetchedAt) {

    public StoredExpansions {
        expansions = List.copyOf(expansions);
    }
}
