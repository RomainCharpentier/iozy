package com.iozycore.core.testing;

import com.iozycore.core.domain.tierlist.EntityRank;
import com.iozycore.core.domain.tierlist.EntityRankRepository;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

/** Shared in-memory double of {@link EntityRankRepository}, for application tests without Spring. */
public class InMemoryEntityRankRepository implements EntityRankRepository {

    private final Map<UUID, EntityRank> byEntityId = new LinkedHashMap<>();

    @Override
    public EntityRank save(EntityRank entityRank) {
        byEntityId.put(entityRank.entityId(), entityRank);
        return entityRank;
    }

    @Override
    public Optional<EntityRank> findByEntityId(UUID entityId) {
        return Optional.ofNullable(byEntityId.get(entityId));
    }

    @Override
    public List<EntityRank> findByEntityIds(Set<UUID> entityIds) {
        return byEntityId.values().stream().filter(r -> entityIds.contains(r.entityId())).toList();
    }

    @Override
    public void deleteByEntityId(UUID entityId) {
        byEntityId.remove(entityId);
    }
}
