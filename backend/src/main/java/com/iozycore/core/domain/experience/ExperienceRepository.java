package com.iozycore.core.domain.experience;

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

    /**
     * Retire une expérience enregistrée par erreur. Idempotent, comme les
     * autres suppressions de petites données utilisateur du projet (wishlist,
     * envie d'amélioration, Tier List) : un double clic ou une tuile devenue
     * obsolète après un rechargement tardif ne doit pas produire d'erreur.
     */
    void deleteById(UUID id);
}
