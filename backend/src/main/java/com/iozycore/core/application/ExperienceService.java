package com.iozycore.core.application;

import com.iozycore.core.domain.catalog.Entity;
import com.iozycore.core.domain.catalog.EntityRepository;
import com.iozycore.core.domain.catalog.EntityType;
import com.iozycore.core.domain.catalog.EntityTypeRepository;
import com.iozycore.core.domain.experience.Experience;
import com.iozycore.core.domain.experience.ExperienceRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/** Use cases of the lived experiences (UC3), independent of ownership. */
@Service
@RequiredArgsConstructor
public class ExperienceService {

    private final ExperienceRepository experienceRepository;
    private final EntityRepository entityRepository;
    private final EntityTypeRepository entityTypeRepository;

    /**
     * Records an experience, without requiring ownership. An unknown work is a
     * bad request (400), not a missing page: the body references it (Batch 28).
     */
    @Transactional
    public Experience record(UUID entityId, UUID variantId, String experienceType, LocalDate occurredAt,
                             Integer rating, String comment) {
        Entity entity = entityRepository.findById(entityId)
                .orElseThrow(() -> new IllegalArgumentException("Entité introuvable : " + entityId));
        // A work always has a known type: a missing one is a server defect (500).
        EntityType entityType = entityTypeRepository.findById(entity.entityTypeId()).orElseThrow();
        if (!entityType.allows(experienceType)) {
            throw new IllegalArgumentException("Type d'expérience '%s' non autorisé pour le type '%s'"
                    .formatted(experienceType, entityType.code()));
        }
        if (variantId != null && entity.variants().stream().noneMatch(v -> v.id().equals(variantId))) {
            throw new IllegalArgumentException("Variant introuvable sur cette Entity : " + variantId);
        }
        return experienceRepository.save(
                Experience.record_(entityId, variantId, experienceType, occurredAt, rating, comment));
    }

    /**
     * Replaces the rating and the comment as they are, null included. The 0-10
     * bound lives in the domain (Experience.updateRating); its refusal is a 400.
     */
    @Transactional
    public Experience update(UUID id, Integer rating, String comment) {
        Experience experience = experienceRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Expérience introuvable : " + id));
        experience.updateRating(rating);
        experience.updateComment(comment);
        return experienceRepository.save(experience);
    }

    /** Idempotent. */
    @Transactional
    public void delete(UUID id) {
        experienceRepository.deleteById(id);
    }

    public List<Experience> ofEntity(UUID entityId) {
        return experienceRepository.findByEntityId(entityId);
    }
}
