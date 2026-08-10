package com.iozycore.api.dto;

import com.iozycore.domain.editionupgrade.EditionUpgradeWish;

import java.time.LocalDate;
import java.util.UUID;

public final class EditionUpgradeWishDtos {

    private EditionUpgradeWishDtos() {
    }

    public record CreateEditionUpgradeWishRequest(UUID entityId, String currentEditionName,
                                                    String desiredEditionName, String note) {
    }

    public record EditionUpgradeWishResponse(UUID id, UUID entityId, String currentEditionName,
                                               String desiredEditionName, String note, LocalDate addedAt) {
        public static EditionUpgradeWishResponse from(EditionUpgradeWish wish) {
            return new EditionUpgradeWishResponse(wish.id(), wish.entityId(), wish.currentEditionName(),
                    wish.desiredEditionName().orElse(null), wish.note().orElse(null), wish.addedAt());
        }
    }

    /** Réponse enrichie pour la liste globale ("Mon profil") - EditionUpgradeWish ne connaît que l'Entity,
     * le titre est de la présentation pure, jamais stocké côté domaine. */
    public record EnrichedEditionUpgradeWishResponse(UUID id, UUID entityId, String entityTitle,
                                                       String currentEditionName, String desiredEditionName,
                                                       String note, LocalDate addedAt) {
    }
}
