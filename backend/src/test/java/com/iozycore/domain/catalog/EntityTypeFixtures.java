package com.iozycore.domain.catalog;

import java.util.Set;
import java.util.UUID;

/**
 * Remplace les anciennes constantes statiques EntityType.MANGA/VIDEO_GAME/
 * BOARD_GAME (supprimées du code de production - les types sont désormais
 * gérés dynamiquement via EntityTypeRepository, éditeur de types). Mêmes
 * UUIDs que les 3 lignes seedées par V1__init_schema.sql, pour rester
 * réalistes face aux tests Testcontainers qui tapent une vraie base.
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
