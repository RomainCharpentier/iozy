package com.iozycore.application;

import com.iozycore.domain.catalog.EntityRepository;
import com.iozycore.domain.catalog.EntityType;
import com.iozycore.domain.catalog.EntityTypeRepository;
import com.iozycore.domain.shared.EntityTypeDeletionNotAllowedException;
import org.springframework.stereotype.Service;

import java.util.Set;
import java.util.UUID;

/**
 * Orchestre l'éditeur de types dynamique : création (code unique),
 * modification (label/schema, jamais le code - même invariant que
 * {@code Entity.entityTypeId()}, voir Entity.java), suppression bloquée
 * tant que des Entity utilisent encore le type (même esprit que
 * {@link EntityDeletionService} pour les Entity elles-mêmes).
 */
@Service
public class EntityTypeService {

    private final EntityTypeRepository entityTypeRepository;
    private final EntityRepository entityRepository;

    public EntityTypeService(EntityTypeRepository entityTypeRepository, EntityRepository entityRepository) {
        this.entityTypeRepository = entityTypeRepository;
        this.entityRepository = entityRepository;
    }

    public EntityType create(String code, String label, Set<String> allowedExperienceTypes,
                              Set<String> customFieldKeys) {
        EntityType candidate = EntityType.create(code, label, allowedExperienceTypes, customFieldKeys);
        entityTypeRepository.findByCode(candidate.code()).ifPresent(existing -> {
            throw new IllegalStateException("Un type avec le code " + candidate.code() + " existe déjà");
        });
        return entityTypeRepository.save(candidate);
    }

    public EntityType update(UUID id, String label, Set<String> allowedExperienceTypes,
                              Set<String> customFieldKeys) {
        EntityType existing = entityTypeRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("EntityType introuvable : " + id));
        EntityType updated = existing.withUpdatedFields(label, allowedExperienceTypes, customFieldKeys);
        return entityTypeRepository.save(updated);
    }

    public void delete(UUID id) {
        if (entityRepository.existsByType(id)) {
            long entityCount = entityRepository.findAllByType(id).size();
            throw new EntityTypeDeletionNotAllowedException(id, entityCount);
        }
        entityTypeRepository.deleteById(id);
    }
}
