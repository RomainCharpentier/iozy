package com.iozycore.core.domain.work;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** The collector statuses of the current account - separated by owner, like the wishes. */
public interface WorkCollectorStatusRepository {

    WorkCollectorStatus save(WorkCollectorStatus status);

    Optional<WorkCollectorStatus> findByEntityId(UUID entityId);

    List<WorkCollectorStatus> findAll();
}
