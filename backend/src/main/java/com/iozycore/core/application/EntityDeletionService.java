package com.iozycore.core.application;

import com.iozycore.core.domain.catalog.EntityRepository;
import com.iozycore.core.domain.experience.ExperienceRepository;
import com.iozycore.core.domain.ownership.OwnershipRepository;
import com.iozycore.core.domain.shared.EntityDeletionNotAllowedException;
import org.springframework.stereotype.Service;

import java.util.UUID;
import java.util.List;

/**
 * Expresses in the application layer the rule validated in step 7: the
 * deletion of an Entity is blocked as long as there are Ownerships
 * or Experiences that reference it. It is not up to the domain to
 * know the repositories of the other aggregates (they are
 * independent), so the rule is orchestrated here rather than in
 * the Entity aggregate itself.
 * <p>
 * Target catalog model Series -> Edition -> Volume (step 5): also blocked
 * as long as a catalog Edition ({@code MangaEdition.entityId}) still references
 * this Entity - without this guard, deleting an Entity whose Volumes
 * were all already removed one by one (see VariantDeletionService) but of which
 * an Edition still survives (e.g. market observations exist for
 * it) would be rejected with a raw SQL error rather than a clear message.
 */
@Service
public class EntityDeletionService {

    private final EntityRepository entityRepository;
    private final OwnershipRepository ownershipRepository;
    private final ExperienceRepository experienceRepository;
    /** What each universe can still hold - the reference editions of a manga (Batch 133). */
    private final List<EntityDeletionGuard> guards;

    public EntityDeletionService(EntityRepository entityRepository,
                                  OwnershipRepository ownershipRepository,
                                  ExperienceRepository experienceRepository,
                                  List<EntityDeletionGuard> guards) {
        this.entityRepository = entityRepository;
        this.ownershipRepository = ownershipRepository;
        this.experienceRepository = experienceRepository;
        this.guards = guards;
    }

    public void delete(UUID entityId) {
        long ownershipCount = ownershipRepository.findByEntityId(entityId).size();
        long experienceCount = experienceRepository.findByEntityId(entityId).size();
        long editionCount = guards.stream().mapToLong(guard -> guard.referencesRestantes(entityId)).sum();

        if (ownershipCount > 0 || experienceCount > 0 || editionCount > 0) {
            throw new EntityDeletionNotAllowedException(entityId, ownershipCount, experienceCount, editionCount);
        }

        entityRepository.deleteById(entityId);
    }
}
