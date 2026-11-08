package com.iozycore.boardgame.expansion;

import java.util.List;

/** The provider that lists the expansions of a base game (BoardGameGeek). */
public interface ExpansionSource {

    /**
     * @return the expansions, empty when the provider answered and knows none
     * @throws com.iozycore.core.metadata.SourceUnavailableException when the provider did not answer:
     *         never an empty list in that case
     */
    List<BoardGameExpansion> expansionsOf(String baseBggId);
}
