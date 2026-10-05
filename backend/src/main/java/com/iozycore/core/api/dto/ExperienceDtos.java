package com.iozycore.core.api.dto;

import com.iozycore.core.domain.experience.Experience;

import java.time.LocalDate;
import java.util.UUID;

public final class ExperienceDtos {

    private ExperienceDtos() {
    }

    /** variantId (optional) says which volume the experience is about - see Experience on the domain side. */
    public record RecordExperienceRequest(UUID entityId, UUID variantId, String experienceType, LocalDate occurredAt,
                                           Integer rating, String comment) {
    }

    /**
     * Fixes an already recorded experience. Only the rating and the comment
     * can be changed: the experience type, the date and the volume concerned
     * are immutable on the domain side (see Experience) - getting the type or the
     * volume wrong means having recorded ANOTHER experience, which is deleted.
     * <p>
     * Both fields are replaced as they are, {@code null} included: this is
     * what allows erasing a rating or a comment, impossible with a
     * "null = unchanged" semantics. The form always sends both
     * of them.
     */
    public record UpdateExperienceRequest(Integer rating, String comment) {
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
