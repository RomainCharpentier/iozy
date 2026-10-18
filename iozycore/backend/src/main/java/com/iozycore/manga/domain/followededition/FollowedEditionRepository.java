package com.iozycore.manga.domain.followededition;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface FollowedEditionRepository {

    FollowedEdition save(FollowedEdition followedEdition);

    /** The followed edition of a series, empty if the user designated none
     *  (normal case: a series with a single edition has nothing to choose). */
    Optional<FollowedEdition> findByEntityId(UUID entityId);

    /** The followed editions of several series at once - "Ma collection"
     *  shows one progression per series and must not issue one query
     *  per row. */
    List<FollowedEdition> findByEntityIdIn(List<UUID> entityIds);

    void deleteByEntityId(UUID entityId);
}
