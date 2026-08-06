package com.iozycore.metadata.bgg;

/** Un jeu marqué "possédé" (own="1") dans la collection BGG d'un utilisateur. */
public record BggCollectionItem(String externalId, String title, String yearPublished) {
}
