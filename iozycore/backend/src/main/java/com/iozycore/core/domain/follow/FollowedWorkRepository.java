package com.iozycore.core.domain.follow;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** The followed works of the current account - separated by owner, like the wishes. */
public interface FollowedWorkRepository {

    FollowedWork save(FollowedWork work);

    Optional<FollowedWork> findByEntityId(UUID entityId);

    List<FollowedWork> findAll();

    /** Idempotent: not following is also the normal case, nothing to report. */
    void deleteByEntityId(UUID entityId);
}
