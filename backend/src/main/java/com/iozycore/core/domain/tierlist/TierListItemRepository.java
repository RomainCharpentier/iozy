package com.iozycore.core.domain.tierlist;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface TierListItemRepository {

    TierListItem save(TierListItem item);

    Optional<TierListItem> findByTierListIdAndEntityId(UUID tierListId, UUID entityId);

    /** Tous les éléments d'une Tier List (board complet, classés et non classés). */
    List<TierListItem> findByTierListId(UUID tierListId);

    /** Toutes les Tier Lists personnalisées dont fait partie une Entity - voir "Mes classements" côté fiche. */
    List<TierListItem> findByEntityId(UUID entityId);

    void deleteByTierListIdAndEntityId(UUID tierListId, UUID entityId);

    /** Purge complète au moment de supprimer la Tier List elle-même. */
    void deleteByTierListId(UUID tierListId);
}
