package com.iozycore.boardgame.bgg;

/**
 * A game marked "owned" (own="1") in a user's BGG collection. The hot list
 * reuses it with only id and title.
 * <p>
 * The collection answer already carries the cover and, with stats=1, the
 * players and playing time: reading them here spares one /thing call per
 * imported game. Each of these fields can be {@code null}.
 */
public record BggCollectionItem(String externalId, String title, String yearPublished,
                                String imageUrl, Integer minPlayers, Integer maxPlayers,
                                Integer playingTimeMinutes) {

    public BggCollectionItem(String externalId, String title, String yearPublished) {
        this(externalId, title, yearPublished, null, null, null, null);
    }
}
