package com.iozycore.core.domain.tierlist;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface TierListItemRepository {

    TierListItem save(TierListItem item);

    Optional<TierListItem> findByTierListIdAndEntityId(UUID tierListId, UUID entityId);

    /** All items of a Tier List (full board, ranked and unranked). */
    List<TierListItem> findByTierListId(UUID tierListId);

    /** All custom Tier Lists that an Entity belongs to - see "My rankings" on the detail page. */
    List<TierListItem> findByEntityId(UUID entityId);

    void deleteByTierListIdAndEntityId(UUID tierListId, UUID entityId);

    /** Full purge when deleting the Tier List itself. */
    void deleteByTierListId(UUID tierListId);
}
