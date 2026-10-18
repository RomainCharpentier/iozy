/**
 * Board games: BoardGameGeek for search, collection import, and the
 * hot list for Discover. The root holds the facades to
 * the core, {@code bgg} the source, {@code api} the import.
 *
 * <p>A universe depends on the core, never the other way round, never on another universe
 * (Batch 133) - checked by the modules test.
 */
@org.springframework.modulith.ApplicationModule(displayName = "Jeux de société")
package com.iozycore.boardgame;
