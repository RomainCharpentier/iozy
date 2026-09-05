package com.iozycore.manga.api;

import com.iozycore.manga.domain.followededition.FollowedEdition;

import java.time.LocalDate;
import java.util.UUID;

public final class FollowedEditionDtos {

    private FollowedEditionDtos() {
    }

    public record FollowEditionRequest(UUID entityId, String editionName) {
    }

    public record FollowedEditionResponse(UUID id, UUID entityId, String editionName, LocalDate followedAt) {
        public static FollowedEditionResponse from(FollowedEdition followedEdition) {
            return new FollowedEditionResponse(followedEdition.id(), followedEdition.entityId(),
                    followedEdition.editionName(), followedEdition.followedAt());
        }
    }
}
