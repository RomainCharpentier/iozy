package com.iozycore.core.domain.tierlist;

import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

public interface EntityRankRepository {

    EntityRank save(EntityRank entityRank);

    Optional<EntityRank> findByEntityId(UUID entityId);

    /** All ranked entities of a universe (general board - see TierListService for the grouping by rank + the "to rank" queue). */
    List<EntityRank> findByEntityIds(Set<UUID> entityIds);

    void deleteByEntityId(UUID entityId);
}
