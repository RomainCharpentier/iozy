package com.iozycore.domain.tierlist;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface TierListRepository {

    TierList save(TierList tierList);

    Optional<TierList> findById(UUID id);

    /** Tier Lists personnalisées d'un univers (voir le Hub Découvrir, groupées par EntityType).
     * N'inclut JAMAIS les listes transverses (entityTypeId null) : elles n'appartiennent à aucun
     * univers, et les faire apparaître sous chacun les afficherait autant de fois qu'il y a de types. */
    List<TierList> findByEntityTypeId(UUID entityTypeId);

    /** Tier Lists transverses "toutes catégories" (voir TierList.isAllUniverses). */
    List<TierList> findAllUniversesLists();

    void deleteById(UUID id);
}
