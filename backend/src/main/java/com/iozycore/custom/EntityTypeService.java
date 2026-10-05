package com.iozycore.custom;

import com.iozycore.core.domain.catalog.EntityRepository;
import com.iozycore.core.domain.catalog.EntityType;
import com.iozycore.core.domain.catalog.EntityTypeRepository;
import com.iozycore.core.domain.shared.EntityTypeDeletionNotAllowedException;
import org.springframework.stereotype.Service;

import java.util.Set;
import java.util.UUID;

/**
 * Orchestrates the dynamic type editor: creation (unique code),
 * update (label/schema, never the code - same invariant as
 * {@code Entity.entityTypeId()}, see Entity.java), deletion blocked
 * while Entity objects still use the type (same spirit as
 * {@link EntityDeletionService} for the Entity objects themselves).
 */
@Service
public class EntityTypeService {

    private final EntityTypeRepository entityTypeRepository;
    private final EntityRepository entityRepository;

    public EntityTypeService(EntityTypeRepository entityTypeRepository, EntityRepository entityRepository) {
        this.entityTypeRepository = entityTypeRepository;
        this.entityRepository = entityRepository;
    }

    /** Variant with visual identity - see EntityType.colorKey/iconKey. */
    public EntityType create(String code, String label, Set<String> allowedExperienceTypes,
                              Set<String> customFieldKeys, String colorKey, String iconKey, String aspectKey) {
        EntityType candidate = EntityType.create(code, label, allowedExperienceTypes, customFieldKeys, colorKey,
                iconKey, aspectKey);
        entityTypeRepository.findByCode(candidate.code()).ifPresent(existing -> {
            throw new IllegalStateException("Un type avec le code " + candidate.code() + " existe déjà");
        });
        return entityTypeRepository.save(candidate);
    }

    public EntityType update(UUID id, String label, Set<String> allowedExperienceTypes,
                              Set<String> customFieldKeys, String colorKey, String iconKey, String aspectKey) {
        EntityType existing = entityTypeRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("EntityType introuvable : " + id));
        return entityTypeRepository.save(existing.withUpdatedFields(label, allowedExperienceTypes, customFieldKeys,
                colorKey, iconKey, aspectKey));
    }

    public EntityType create(String code, String label, Set<String> allowedExperienceTypes,
                              Set<String> customFieldKeys) {
        return create(code, label, allowedExperienceTypes, customFieldKeys, null, null, null);
    }

    public EntityType update(UUID id, String label, Set<String> allowedExperienceTypes,
                              Set<String> customFieldKeys) {
        EntityType existing = entityTypeRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("EntityType introuvable : " + id));
        // Without visual keys provided, the ones already saved are kept (see
        // EntityType.withUpdatedFields with 3 arguments) - a caller that ignores
        // this notion must not erase it by omission.
        return entityTypeRepository.save(existing.withUpdatedFields(label, allowedExperienceTypes, customFieldKeys));
    }

    public void delete(UUID id) {
        if (entityRepository.existsByType(id)) {
            long entityCount = entityRepository.findAllByType(id).size();
            throw new EntityTypeDeletionNotAllowedException(id, entityCount);
        }
        entityTypeRepository.deleteById(id);
    }
}
