package com.iozycore.core.domain.tierlist;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface TierListRepository {

    TierList save(TierList tierList);

    Optional<TierList> findById(UUID id);

    /**
     * Loads several lists at once, with the same owner rule as findById.
     * Unknown ids are left out, and the order of the result is not defined.
     * The default calls findById once per id: the real adapter overrides it
     * with one query.
     */
    default List<TierList> findAllById(Collection<UUID> ids) {
        return ids.stream().distinct().map(this::findById).flatMap(Optional::stream).toList();
    }

    /** Custom Tier Lists of a universe (see the Discover Hub, grouped by EntityType).
     * NEVER includes cross-cutting lists (entityTypeId null): they belong to no
     * universe, and showing them under each one would display them as many times as there are types. */
    List<TierList> findByEntityTypeId(UUID entityTypeId);

    /** Cross-cutting "all categories" Tier Lists (see TierList.isAllUniverses). */
    List<TierList> findAllUniversesLists();

    void deleteById(UUID id);
}
