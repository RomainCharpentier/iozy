package com.iozycore.api.dto;

import com.iozycore.domain.experience.Experience;

import java.time.LocalDate;
import java.util.UUID;

public final class ExperienceDtos {

    private ExperienceDtos() {
    }

    /** variantId (facultatif) précise quel tome l'expérience concerne - voir Experience côté domaine. */
    public record RecordExperienceRequest(UUID entityId, UUID variantId, String experienceType, LocalDate occurredAt,
                                           Integer rating, String comment) {
    }

    public record ExperienceResponse(UUID id, UUID entityId, UUID variantId, String experienceType,
                                      LocalDate occurredAt, Integer rating, String comment) {
        public static ExperienceResponse from(Experience experience) {
            return new ExperienceResponse(
                    experience.id(), experience.entityId(), experience.variantId().orElse(null),
                    experience.experienceType(), experience.occurredAt(), experience.rating().orElse(null),
                    experience.comment());
        }
    }
}
