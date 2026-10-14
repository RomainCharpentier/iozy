package com.iozycore.core.testing;

import com.iozycore.core.domain.catalog.EntityType;
import com.iozycore.core.domain.catalog.EntityTypeRepository;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/** Shared in-memory double of {@link EntityTypeRepository}, for application tests without Spring. */
public class InMemoryEntityTypeRepository implements EntityTypeRepository {

    private final Map<UUID, EntityType> store = new LinkedHashMap<>();

    public InMemoryEntityTypeRepository(EntityType... types) {
        for (EntityType type : types) {
            save(type);
        }
    }

    @Override
    public EntityType save(EntityType entityType) {
        store.put(entityType.id(), entityType);
        return entityType;
    }

    @Override
    public Optional<EntityType> findById(UUID id) {
        return Optional.ofNullable(store.get(id));
    }

    @Override
    public Optional<EntityType> findByCode(String code) {
        return store.values().stream().filter(t -> t.code().equals(code)).findFirst();
    }

    @Override
    public List<EntityType> findAll() {
        return List.copyOf(store.values());
    }

    @Override
    public void deleteById(UUID id) {
        store.remove(id);
    }
}
