package com.iozycore.core.testing;

import com.iozycore.core.domain.tierlist.TierListItem;
import com.iozycore.core.domain.tierlist.TierListItemRepository;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/** Shared in-memory double of {@link TierListItemRepository}, for application tests without Spring. */
public class InMemoryTierListItemRepository implements TierListItemRepository {

    private final Map<UUID, TierListItem> store = new LinkedHashMap<>();

    @Override
    public TierListItem save(TierListItem item) {
        store.put(item.id(), item);
        return item;
    }

    @Override
    public Optional<TierListItem> findByTierListIdAndEntityId(UUID tierListId, UUID entityId) {
        return store.values().stream()
                .filter(i -> i.tierListId().equals(tierListId) && i.entityId().equals(entityId))
                .findFirst();
    }

    @Override
    public List<TierListItem> findByTierListId(UUID tierListId) {
        return store.values().stream().filter(i -> i.tierListId().equals(tierListId)).toList();
    }

    @Override
    public List<TierListItem> findByEntityId(UUID entityId) {
        return store.values().stream().filter(i -> i.entityId().equals(entityId)).toList();
    }

    @Override
    public void deleteByTierListIdAndEntityId(UUID tierListId, UUID entityId) {
        store.values().removeIf(i -> i.tierListId().equals(tierListId) && i.entityId().equals(entityId));
    }

    @Override
    public void deleteByTierListId(UUID tierListId) {
        store.values().removeIf(i -> i.tierListId().equals(tierListId));
    }
}
