package com.iozycore.core.testing;

import com.iozycore.core.domain.ownership.Ownership;
import com.iozycore.core.domain.ownership.OwnershipRepository;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/** Shared in-memory double of {@link OwnershipRepository}, for application tests without Spring. */
public class InMemoryOwnershipRepository implements OwnershipRepository {

    private final Map<UUID, Ownership> store = new LinkedHashMap<>();

    @Override
    public Ownership save(Ownership ownership) {
        store.put(ownership.id(), ownership);
        return ownership;
    }

    @Override
    public Optional<Ownership> findById(UUID id) {
        return Optional.ofNullable(store.get(id));
    }

    @Override
    public List<Ownership> findByEntityId(UUID entityId) {
        return store.values().stream().filter(o -> o.entityId().equals(entityId)).toList();
    }

    @Override
    public List<Ownership> findAll() {
        return List.copyOf(store.values());
    }

    @Override
    public boolean existsByEntityId(UUID entityId) {
        return store.values().stream().anyMatch(o -> o.entityId().equals(entityId));
    }

    @Override
    public void deleteById(UUID id) {
        store.remove(id);
    }
}
