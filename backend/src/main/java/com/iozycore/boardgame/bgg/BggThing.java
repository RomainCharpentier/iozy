package com.iozycore.boardgame.bgg;

import java.util.List;
import java.util.Set;

/**
 * What the BGG /thing endpoint says about one game. Every field can be
 * missing: BGG leaves out what its contributors did not fill in.
 *
 * @param imageUrl               the cover, or {@code null}
 * @param yearPublished          as BGG writes it ("2000"), or {@code null}
 * @param minPlayers             or {@code null}
 * @param maxPlayers             or {@code null}
 * @param playingTimeMinutes     or {@code null}
 * @param designers              in BGG order, never {@code null}
 * @param categoriesAndMechanics both kinds of link mixed, never {@code null}
 */
public record BggThing(String imageUrl, String yearPublished, Integer minPlayers, Integer maxPlayers,
                       Integer playingTimeMinutes, List<String> designers, Set<String> categoriesAndMechanics) {
}
