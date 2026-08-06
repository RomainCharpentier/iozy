package com.iozycore.application;

import com.iozycore.domain.catalog.EntityRepository;
import com.iozycore.domain.experience.ExperienceRepository;
import com.iozycore.domain.ownership.OwnershipRepository;
import com.iozycore.domain.shared.EntityDeletionNotAllowedException;
import org.springframework.stereotype.Service;

import java.util.UUID;

/**
 * Traduit en couche application la règle validée à l'étape 7 : la
 * suppression d'une Entity est bloquée tant qu'il existe des Ownership
 * ou des Experience qui la référencent. Ce n'est pas au domaine de
 * connaître les repositories des autres agrégats (ils sont
 * indépendants), donc la règle est orchestrée ici plutôt que dans
 * l'agrégat Entity lui-même.
 */
@Service
public class EntityDeletionService {

    private final EntityRepository entityRepository;
    private final OwnershipRepository ownershipRepository;
    private final ExperienceRepository experienceRepository;

    public EntityDeletionService(EntityRepository entityRepository,
                                  OwnershipRepository ownershipRepository,
                                  ExperienceRepository experienceRepository) {
        this.entityRepository = entityRepository;
        this.ownershipRepository = ownershipRepository;
        this.experienceRepository = experienceRepository;
    }

    public void delete(UUID entityId) {
        boolean hasOwnerships = ownershipRepository.existsByEntityId(entityId);
        boolean hasExperiences = experienceRepository.existsByEntityId(entityId);

        if (hasOwnerships || hasExperiences) {
            long ownershipCount = ownershipRepository.findByEntityId(entityId).size();
            long experienceCount = experienceRepository.findByEntityId(entityId).size();
            throw new EntityDeletionNotAllowedException(entityId, ownershipCount, experienceCount);
        }

        entityRepository.deleteById(entityId);
    }
}
