package com.iozycore.domain.experience;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ExperienceRepository {

    Experience save(Experience experience);

    Optional<Experience> findById(UUID id);

    List<Experience> findByEntityId(UUID entityId);

    /** Utilisé par la règle de suppression d'une Entity (étape 7 : invariant DDD). */
    /** Utilisé par le Bounded Context Insights (étape 8) pour calculer les statistiques. */
    List<Experience> findAll();

    boolean existsByEntityId(UUID entityId);
}
