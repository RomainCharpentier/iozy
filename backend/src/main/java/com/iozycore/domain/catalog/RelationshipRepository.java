package com.iozycore.domain.catalog;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface RelationshipRepository {

    Relationship save(Relationship relationship);

    /** Utilisé pour corriger le type d'une relation existante sans en changer les extrémités. */
    Optional<Relationship> findById(UUID id);

    List<Relationship> findBySourceEntityId(UUID sourceEntityId);

    List<Relationship> findByTargetEntityId(UUID targetEntityId);

    /** Utilisé par l'export complet de la collection (§19, docs/CONCEPTION.md - anti-enfermement). */
    List<Relationship> findAll();

    /**
     * Retire une relation créée par erreur. Ne touche à aucune des deux œuvres
     * liées - seul le lien disparaît. Idempotent, comme les autres suppressions
     * de petites données utilisateur du projet.
     */
    void deleteById(UUID id);
}
