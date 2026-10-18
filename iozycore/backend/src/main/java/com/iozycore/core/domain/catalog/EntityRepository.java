package com.iozycore.core.domain.catalog;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Domain port for the persistence of Entity. The implementation
 * (JPA/PostgreSQL) lives in infrastructure - the domain only knows
 * this interface (Clean Architecture, steps 10-11 of the design).
 */
public interface EntityRepository {

    Entity save(Entity entity);

    Optional<Entity> findById(UUID id);

    /**
     * Used by the deduplication of quick add (UC1, step 6):
     * case-insensitive search, to find an Entity already
     * cataloged before creating a duplicate.
     */
    Optional<Entity> findByTypeAndTitle(UUID entityTypeId, String title);

    /** Used to refresh a client after a bulk import (e.g. BGG collection). */
    List<Entity> findAllByType(UUID entityTypeId);

    /** Used by the delete guard of an EntityType (we do not load the Entity just to count). */
    boolean existsByType(UUID entityTypeId);

    /**
     * Cross-cutting search on the collection (UC4, step 1/6 of the
     * design: "instant cross-cutting search"). entityTypeId and
     * tagId are optional filters (null = no filter on this criterion).
     */
    List<Entity> search(String titleQuery, UUID entityTypeId, UUID tagId);

    void deleteById(UUID id);
}
