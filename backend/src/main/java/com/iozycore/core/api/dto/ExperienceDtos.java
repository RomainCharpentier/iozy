package com.iozycore.core.api.dto;

import com.iozycore.core.domain.experience.Experience;

import java.time.LocalDate;
import java.util.UUID;

public final class ExperienceDtos {

    private ExperienceDtos() {
    }

    /** variantId (facultatif) précise quel tome l'expérience concerne - voir Experience côté domaine. */
    public record RecordExperienceRequest(UUID entityId, UUID variantId, String experienceType, LocalDate occurredAt,
                                           Integer rating, String comment) {
    }

    /**
     * Corrige une expérience déjà enregistrée. Seuls la note et le commentaire
     * sont modifiables : le type d'expérience, la date et le tome concerné
     * sont immuables côté domaine (voir Experience) - se tromper de type ou de
     * tome, c'est avoir enregistré une AUTRE expérience, qu'on supprime.
     * <p>
     * Les deux champs sont remplacés tels quels, {@code null} compris : c'est
     * ce qui permet d'effacer une note ou un commentaire, impossible avec une
     * sémantique « null = inchangé ». Le formulaire les envoie toujours tous
     * les deux.
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
