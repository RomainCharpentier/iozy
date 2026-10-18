package com.iozycore.core.domain.tierlist;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface TierListRepository {

    TierList save(TierList tierList);

    Optional<TierList> findById(UUID id);

    /** Custom Tier Lists of a universe (see the Discover Hub, grouped by EntityType).
     * NEVER includes cross-cutting lists (entityTypeId null): they belong to no
     * universe, and showing them under each one would display them as many times as there are types. */
    List<TierList> findByEntityTypeId(UUID entityTypeId);

    /** Cross-cutting "all categories" Tier Lists (see TierList.isAllUniverses). */
    List<TierList> findAllUniversesLists();

    void deleteById(UUID id);
}
