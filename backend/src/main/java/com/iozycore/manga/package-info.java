/**
 * Tout ce qui n'existe que pour un manga : tomes et éditions françaises,
 * éditions suivies, progression et liste de lecture, sources (AniList, Jikan,
 * MyAnimeList, Google Books, BnF, Open Library), analyse d'achat d'un lot,
 * reconnaissance des piles par ISBN. Les classes de la racine sont ses
 * façades vers le cœur : les implémentations des points d'extension.
 *
 * <p>Un univers dépend du cœur, jamais l'inverse, jamais d'un autre univers
 * (Lot 133) - vérifié par le test des modules.
 */
@org.springframework.modulith.ApplicationModule(displayName = "Mangas")
package com.iozycore.manga;
