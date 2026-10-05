package com.iozycore.core.domain.ownership;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface OwnershipRepository {

    Ownership save(Ownership ownership);

    Optional<Ownership> findById(UUID id);

    List<Ownership> findByEntityId(UUID entityId);

    /** Used by the delete rule of an Entity (step 7: DDD invariant). */
    /** Used by the Insights Bounded Context (step 8) to compute the statistics. */
    List<Ownership> findAll();

    boolean existsByEntityId(UUID entityId);

    /** Used by the delete rule of an Ownership (see OwnershipDeletionService). */
    void deleteById(UUID id);
}
