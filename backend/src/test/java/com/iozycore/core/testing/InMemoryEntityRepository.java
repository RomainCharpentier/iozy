package com.iozycore.core.testing;

import com.iozycore.core.domain.catalog.Entity;
import com.iozycore.core.domain.catalog.EntityRepository;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/** Shared in-memory double of {@link EntityRepository}, for application tests without Spring. */
public class InMemoryEntityRepository implements EntityRepository {

    private final Map<UUID, Entity> store = new LinkedHashMap<>();

    @Override
    public Entity save(Entity entity) {
        store.put(entity.id(), entity);
        return entity;
    }

    @Override
    public Optional<Entity> findById(UUID id) {
        return Optional.ofNullable(store.get(id));
    }

    @Override
    public Optional<Entity> findByTypeAndTitle(UUID entityTypeId, String title) {
        return store.values().stream()
                .filter(e -> e.entityTypeId().equals(entityTypeId) && e.title().equalsIgnoreCase(title))
                .findFirst();
    }

    @Override
    public List<Entity> findAllByType(UUID entityTypeId) {
        return store.values().stream().filter(e -> e.entityTypeId().equals(entityTypeId)).toList();
    }

    @Override
    public boolean existsByType(UUID entityTypeId) {
        return store.values().stream().anyMatch(e -> e.entityTypeId().equals(entityTypeId));
    }

    @Override
    public List<Entity> search(String titleQuery, UUID entityTypeId, UUID tagId) {
        return store.values().stream()
                .filter(e -> titleQuery == null || titleQuery.isBlank()
                        || e.title().toLowerCase().contains(titleQuery.toLowerCase()))
                .filter(e -> entityTypeId == null || e.entityTypeId().equals(entityTypeId))
                .filter(e -> tagId == null || e.tagIds().contains(tagId))
                .toList();
    }

    @Override
    public void deleteById(UUID id) {
        store.remove(id);
    }

    public int count() {
        return store.size();
    }
}
