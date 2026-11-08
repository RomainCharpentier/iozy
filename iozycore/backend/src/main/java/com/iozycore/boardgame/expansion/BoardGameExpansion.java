package com.iozycore.boardgame.expansion;

/**
 * One expansion of a board game, as BoardGameGeek lists it.
 *
 * @param bggId         its own BGG id
 * @param name          its BGG name ("Catan: Seafarers")
 * @param imageUrl      its cover, or {@code null} when BGG gave none
 * @param yearPublished as BGG writes it ("1997"), or {@code null}
 */
public record BoardGameExpansion(String bggId, String name, String imageUrl, String yearPublished) {
}
