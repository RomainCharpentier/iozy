package com.iozycore.core.testing;

import com.iozycore.core.domain.tierlist.TierList;
import com.iozycore.core.domain.tierlist.TierListRepository;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/** Shared in-memory double of {@link TierListRepository}, for application tests without Spring. */
public class InMemoryTierListRepository implements TierListRepository {

    private final Map<UUID, TierList> store = new LinkedHashMap<>();

    @Override
    public TierList save(TierList tierList) {
        store.put(tierList.id(), tierList);
        return tierList;
    }

    @Override
    public Optional<TierList> findById(UUID id) {
        return Optional.ofNullable(store.get(id));
    }

    @Override
    public List<TierList> findByEntityTypeId(UUID entityTypeId) {
        return store.values().stream()
                .filter(l -> l.entityTypeId().map(entityTypeId::equals).orElse(false))
                .toList();
    }

    @Override
    public List<TierList> findAllUniversesLists() {
        return store.values().stream().filter(TierList::isAllUniverses).toList();
    }

    @Override
    public void deleteById(UUID id) {
        store.remove(id);
    }
}
