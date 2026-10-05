package com.iozycore.core.domain.catalog;

import java.util.Set;
import java.util.UUID;

/**
 * Replaces the old static constants EntityType.MANGA/VIDEO_GAME/
 * BOARD_GAME (removed from the production code - types are now
 * managed dynamically via EntityTypeRepository, type editor). Same
 * UUIDs as the 3 rows seeded by V1__init_schema.sql, to stay
 * realistic against Testcontainers tests that hit a real database.
 */
public final class EntityTypeFixtures {

    private EntityTypeFixtures() {
    }

    public static final EntityType MANGA = EntityType.reconstitute(
            UUID.fromString("00000000-0000-0000-0000-000000000001"),
            "MANGA",
            "Manga",
            Set.of("READ", "IN_PROGRESS", "ABANDONED"),
            Set.of("mangaka", "publisher", "volumeNumber", "seriesStatus")
    );

    public static final EntityType VIDEO_GAME = EntityType.reconstitute(
            UUID.fromString("00000000-0000-0000-0000-000000000002"),
            "VIDEO_GAME",
            "Jeu vidéo",
            Set.of("FINISHED", "IN_PROGRESS", "ABANDONED"),
            Set.of("platform", "studio", "averageDurationHours")
    );

    public static final EntityType BOARD_GAME = EntityType.reconstitute(
            UUID.fromString("00000000-0000-0000-0000-000000000003"),
            "BOARD_GAME",
            "Jeu de société",
            Set.of("PLAYED"),
            Set.of("minPlayers", "maxPlayers", "averageDurationMinutes")
    );
}
