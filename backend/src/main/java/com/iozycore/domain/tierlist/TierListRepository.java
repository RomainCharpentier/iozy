package com.iozycore.domain.tierlist;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface TierListRepository {

    TierList save(TierList tierList);

    Optional<TierList> findById(UUID id);

    /** Tier Lists personnalisées d'un univers (voir le Hub Découvrir, groupées par EntityType). */
    List<TierList> findByEntityTypeId(UUID entityTypeId);

    void deleteById(UUID id);
}
