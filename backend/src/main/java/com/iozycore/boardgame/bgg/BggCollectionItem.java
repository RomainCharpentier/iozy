package com.iozycore.boardgame.bgg;

/** A game marked "owned" (own="1") in a user's BGG collection. */
public record BggCollectionItem(String externalId, String title, String yearPublished) {
}
