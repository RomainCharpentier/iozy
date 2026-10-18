package com.iozycore.manga.application;

import com.iozycore.core.application.WorkFollowing;
import com.iozycore.core.domain.catalog.EntityRepository;
import com.iozycore.manga.domain.followededition.FollowedEdition;
import com.iozycore.manga.domain.followededition.FollowedEditionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;
import java.util.UUID;

/** Use cases of the followed edition: the edition of a series that the user collects. */
@Service
@RequiredArgsConstructor
public class EditionFollowing {

    private final FollowedEditionRepository followedEditionRepository;
    private final EntityRepository entityRepository;
    private final WorkFollowing workFollowing;

    /**
     * Follows an edition of a series, in place of the one already followed if
     * any. Following an edition also follows the work (release calendar).
     */
    @Transactional
    public FollowedEdition follow(UUID entityId, String editionName) {
        entityRepository.findById(entityId)
                .orElseThrow(() -> new IllegalArgumentException("Entité introuvable : " + entityId));
        FollowedEdition toSave = followedEditionRepository.findByEntityId(entityId)
                .map(existing -> existing.suivreALaPlace(editionName))
                .orElseGet(() -> FollowedEdition.create(entityId, editionName));
        FollowedEdition saved = followedEditionRepository.save(toSave);
        workFollowing.follow(entityId);
        return saved;
    }

    @Transactional
    public void unfollow(UUID entityId) {
        followedEditionRepository.deleteByEntityId(entityId);
    }

    public Optional<FollowedEdition> of(UUID entityId) {
        return followedEditionRepository.findByEntityId(entityId);
    }
}
