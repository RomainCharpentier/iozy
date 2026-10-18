package com.iozycore.core.domain.experience;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ExperienceRepository {

    Experience save(Experience experience);

    Optional<Experience> findById(UUID id);

    List<Experience> findByEntityId(UUID entityId);

    /** Used by the delete rule of an Entity (step 7: DDD invariant). */
    /** Used by the Insights Bounded Context (step 8) to compute the statistics. */
    List<Experience> findAll();

    boolean existsByEntityId(UUID entityId);

    /**
     * Removes an experience recorded by mistake. Idempotent, like the
     * other deletions of small user data in the project (wishlist,
     * upgrade wish, Tier List): a double click or a tile that became
     * outdated after a late reload must not produce an error.
     */
    void deleteById(UUID id);
}
