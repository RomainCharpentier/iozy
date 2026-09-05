package com.iozycore.core.domain.tierlist;

import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

public interface EntityRankRepository {

    EntityRank save(EntityRank entityRank);

    Optional<EntityRank> findByEntityId(UUID entityId);

    /** Toutes les entités classées d'un univers (board général - voir TierListService pour le regroupement par rang + la file "à classer"). */
    List<EntityRank> findByEntityIds(Set<UUID> entityIds);

    void deleteByEntityId(UUID entityId);
}
