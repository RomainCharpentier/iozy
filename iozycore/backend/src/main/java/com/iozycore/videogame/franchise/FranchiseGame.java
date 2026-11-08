package com.iozycore.videogame.franchise;

import java.util.List;

/**
 * One game of a licence, as IGDB lists it.
 *
 * @param igdbId      its IGDB id
 * @param name        its IGDB name
 * @param coverUrl    its cover, or {@code null}
 * @param platforms   the consoles it came out on, as IGDB names them ("Nintendo Switch"); never {@code null}
 * @param releaseDate its first release, "2023-05-12", or {@code null}
 */
public record FranchiseGame(String igdbId, String name, String coverUrl, List<String> platforms, String releaseDate) {

    public FranchiseGame {
        platforms = platforms == null ? List.of() : List.copyOf(platforms);
    }
}
