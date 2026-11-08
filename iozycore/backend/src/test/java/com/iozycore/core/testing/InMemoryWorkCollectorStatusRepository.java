package com.iozycore.core.testing;

import com.iozycore.core.domain.work.WorkCollectorStatus;
import com.iozycore.core.domain.work.WorkCollectorStatusRepository;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/** Shared in-memory double of {@link WorkCollectorStatusRepository}, for application tests without Spring. */
public class InMemoryWorkCollectorStatusRepository implements WorkCollectorStatusRepository {

    private final Map<UUID, WorkCollectorStatus> byEntityId = new LinkedHashMap<>();

    @Override
    public WorkCollectorStatus save(WorkCollectorStatus status) {
        byEntityId.put(status.entityId(), status);
        return status;
    }

    @Override
    public Optional<WorkCollectorStatus> findByEntityId(UUID entityId) {
        return Optional.ofNullable(byEntityId.get(entityId));
    }

    @Override
    public List<WorkCollectorStatus> findAll() {
        return List.copyOf(byEntityId.values());
    }
}
