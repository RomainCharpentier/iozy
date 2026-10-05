/**
 * Everything that exists only for a manga: French volumes and editions,
 * followed editions, progress and reading list, sources (AniList, Jikan,
 * MyAnimeList, Google Books, BnF, Open Library), purchase analysis of a batch,
 * recognition of stacks by ISBN. The classes at the root are its
 * facades to the core: the implementations of the extension points.
 *
 * <p>A universe depends on the core, never the other way round, never on another universe
 * (Batch 133) - checked by the modules test.
 */
@org.springframework.modulith.ApplicationModule(displayName = "Mangas")
package com.iozycore.manga;
