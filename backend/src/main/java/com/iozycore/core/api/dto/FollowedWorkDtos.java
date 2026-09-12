package com.iozycore.core.api.dto;

import com.iozycore.core.domain.follow.FollowedWork;

import java.time.LocalDate;
import java.util.UUID;

public final class FollowedWorkDtos {

    private FollowedWorkDtos() {
    }

    public record FollowRequest(UUID entityId) {
    }

    public record FollowedWorkResponse(UUID entityId, LocalDate followedAt) {
        public static FollowedWorkResponse from(FollowedWork work) {
            return new FollowedWorkResponse(work.entityId(), work.followedAt());
        }
    }
}
