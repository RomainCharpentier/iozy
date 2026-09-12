package com.iozycore.core.domain.follow;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** Les œuvres suivies du compte courant - cloisonnées par propriétaire, comme les envies. */
public interface FollowedWorkRepository {

    FollowedWork save(FollowedWork work);

    Optional<FollowedWork> findByEntityId(UUID entityId);

    List<FollowedWork> findAll();

    /** Idempotent : ne pas suivre est aussi le cas normal, rien à signaler. */
    void deleteByEntityId(UUID entityId);
}
