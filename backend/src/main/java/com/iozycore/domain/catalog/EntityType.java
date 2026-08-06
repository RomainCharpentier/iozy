package com.iozycore.domain.catalog;

import java.util.Optional;
import java.util.Set;
import java.util.UUID;

/**
 * Définit une catégorie d'Entity : ses champs personnalisés attendus
 * (schema) et les types d'Experience valides pour ce type.
 * <p>
 * Au MVP, seules 3 instances existent, codées en dur via {@link #mvpTypes()} :
 * MANGA, VIDEO_GAME, BOARD_GAME. La structure reste néanmoins un vrai
 * agrégat pour que l'éditeur de types dynamique (V2) ne soit qu'une
 * interface d'édition par-dessus, sans refonte du moteur.
 */
public record EntityType(
        UUID id,
        String code,
        String label,
        Set<String> allowedExperienceTypes,
        Set<String> customFieldKeys
) {

    public static final EntityType MANGA = new EntityType(
            UUID.fromString("00000000-0000-0000-0000-000000000001"),
            "MANGA",
            "Manga",
            Set.of("READ", "IN_PROGRESS", "ABANDONED"),
            Set.of("mangaka", "publisher", "volumeNumber", "seriesStatus")
    );

    public static final EntityType VIDEO_GAME = new EntityType(
            UUID.fromString("00000000-0000-0000-0000-000000000002"),
            "VIDEO_GAME",
            "Jeu vidéo",
            Set.of("FINISHED", "IN_PROGRESS", "ABANDONED"),
            Set.of("platform", "studio", "averageDurationHours")
    );

    public static final EntityType BOARD_GAME = new EntityType(
            UUID.fromString("00000000-0000-0000-0000-000000000003"),
            "BOARD_GAME",
            "Jeu de société",
            Set.of("PLAYED"),
            Set.of("minPlayers", "maxPlayers", "averageDurationMinutes")
    );

    public static Set<EntityType> mvpTypes() {
        return Set.of(MANGA, VIDEO_GAME, BOARD_GAME);
    }

    public static Optional<EntityType> byId(UUID id) {
        return mvpTypes().stream().filter(t -> t.id().equals(id)).findFirst();
    }

    public boolean allows(String experienceType) {
        return allowedExperienceTypes.contains(experienceType);
    }
}
