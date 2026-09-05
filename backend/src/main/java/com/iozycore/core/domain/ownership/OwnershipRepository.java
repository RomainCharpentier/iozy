package com.iozycore.core.domain.ownership;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface OwnershipRepository {

    Ownership save(Ownership ownership);

    Optional<Ownership> findById(UUID id);

    List<Ownership> findByEntityId(UUID entityId);

    /** Utilisé par la règle de suppression d'une Entity (étape 7 : invariant DDD). */
    /** Utilisé par le Bounded Context Insights (étape 8) pour calculer les statistiques. */
    List<Ownership> findAll();

    boolean existsByEntityId(UUID entityId);

    /** Utilisé par la règle de suppression d'une Ownership (voir OwnershipDeletionService). */
    void deleteById(UUID id);
}
