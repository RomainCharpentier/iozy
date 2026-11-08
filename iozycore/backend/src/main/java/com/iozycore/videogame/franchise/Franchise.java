package com.iozycore.videogame.franchise;

import java.util.List;

/**
 * The licence of a game: its name and its games, every console mixed.
 *
 * @param name  the name of the licence ("The Legend of Zelda"), or {@code null} when the game has none
 * @param games the games of the licence, the game itself included; empty when it has none
 */
public record Franchise(String name, List<FranchiseGame> games) {

    public Franchise {
        games = List.copyOf(games);
    }
}
