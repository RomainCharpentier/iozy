package com.iozycore.core.domain.catalog;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface RelationshipRepository {

    Relationship save(Relationship relationship);

    /** Used to fix the type of an existing relationship without changing its ends. */
    Optional<Relationship> findById(UUID id);

    List<Relationship> findBySourceEntityId(UUID sourceEntityId);

    List<Relationship> findByTargetEntityId(UUID targetEntityId);

    /** Used by the full export of the collection (§19, docs/CONCEPTION.md - anti lock-in). */
    List<Relationship> findAll();

    /**
     * Removes a relationship created by mistake. Touches neither of the two linked
     * works - only the link disappears. Idempotent, like the other deletions
     * of small user data in the project.
     */
    void deleteById(UUID id);
}
