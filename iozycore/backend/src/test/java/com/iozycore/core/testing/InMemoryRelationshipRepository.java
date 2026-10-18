package com.iozycore.core.testing;

import com.iozycore.core.domain.catalog.Relationship;
import com.iozycore.core.domain.catalog.RelationshipRepository;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/** Shared in-memory double of {@link RelationshipRepository}, for application tests without Spring. */
public class InMemoryRelationshipRepository implements RelationshipRepository {

    private final Map<UUID, Relationship> store = new LinkedHashMap<>();

    @Override
    public Relationship save(Relationship relationship) {
        store.put(relationship.id(), relationship);
        return relationship;
    }

    @Override
    public Optional<Relationship> findById(UUID id) {
        return Optional.ofNullable(store.get(id));
    }

    @Override
    public List<Relationship> findBySourceEntityId(UUID sourceEntityId) {
        return store.values().stream().filter(r -> r.sourceEntityId().equals(sourceEntityId)).toList();
    }

    @Override
    public List<Relationship> findByTargetEntityId(UUID targetEntityId) {
        return store.values().stream().filter(r -> r.targetEntityId().equals(targetEntityId)).toList();
    }

    @Override
    public List<Relationship> findAll() {
        return List.copyOf(store.values());
    }

    @Override
    public void deleteById(UUID id) {
        store.remove(id);
    }
}
