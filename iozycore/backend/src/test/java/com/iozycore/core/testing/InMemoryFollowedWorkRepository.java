package com.iozycore.core.testing;

import com.iozycore.core.domain.follow.FollowedWork;
import com.iozycore.core.domain.follow.FollowedWorkRepository;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/** Shared in-memory double of {@link FollowedWorkRepository}, for application tests without Spring. */
public class InMemoryFollowedWorkRepository implements FollowedWorkRepository {

    private final Map<UUID, FollowedWork> byEntityId = new LinkedHashMap<>();

    @Override
    public FollowedWork save(FollowedWork work) {
        byEntityId.put(work.entityId(), work);
        return work;
    }

    @Override
    public Optional<FollowedWork> findByEntityId(UUID entityId) {
        return Optional.ofNullable(byEntityId.get(entityId));
    }

    @Override
    public List<FollowedWork> findAll() {
        return List.copyOf(byEntityId.values());
    }

    @Override
    public void deleteByEntityId(UUID entityId) {
        byEntityId.remove(entityId);
    }
}
