package com.iozycore.manga.domain.followededition;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface FollowedEditionRepository {

    FollowedEdition save(FollowedEdition followedEdition);

    /** L'édition suivie d'une série, vide si l'utilisateur n'en a désigné aucune
     *  (cas normal : une série à édition unique n'a rien à choisir). */
    Optional<FollowedEdition> findByEntityId(UUID entityId);

    /** Les éditions suivies de plusieurs séries d'un coup - « Ma collection »
     *  affiche une progression par série et ne doit pas émettre une requête
     *  par ligne. */
    List<FollowedEdition> findByEntityIdIn(List<UUID> entityIds);

    void deleteByEntityId(UUID entityId);
}
