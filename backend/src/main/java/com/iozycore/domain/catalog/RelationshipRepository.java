package com.iozycore.domain.catalog;

import java.util.List;
import java.util.UUID;

public interface RelationshipRepository {

    Relationship save(Relationship relationship);

    List<Relationship> findBySourceEntityId(UUID sourceEntityId);

    List<Relationship> findByTargetEntityId(UUID targetEntityId);

    /** Utilisé par l'export complet de la collection (§19, docs/CONCEPTION.md - anti-enfermement). */
    List<Relationship> findAll();

    void deleteById(UUID id);
}
