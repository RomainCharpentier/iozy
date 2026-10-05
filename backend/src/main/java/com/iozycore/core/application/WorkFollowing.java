package com.iozycore.core.application;

import com.iozycore.core.domain.catalog.EntityRepository;
import com.iozycore.core.domain.follow.FollowedWork;
import com.iozycore.core.domain.follow.FollowedWorkRepository;
import com.iozycore.core.domain.ownership.OwnershipAdded;
import com.iozycore.core.domain.ownership.OwnershipRepository;
import com.iozycore.core.domain.wishlist.WishlistEntryRepository;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.UUID;

/**
 * Follow a work, and hold the "one state at a time" rule.
 *
 * <p>Owned, Followed, Wish: a trinity where each state is unique (user
 * feedback of 2026-09-11). This service is the only place that knows the
 * moves from one to the other, for the WORK:
 * <ul>
 *   <li>following removes the wish for the work;</li>
 *   <li>wanting the whole work removes it from the followed ones (see WishlistController);</li>
 *   <li>owning the work as a single piece removes it from the followed ones (see the event
 *       OwnershipAdded).</li>
 * </ul>
 * A VOLUME changes nothing to the state of its series: acquiring volume 12 of a
 * followed series is exactly what following means, and wanting volume 13
 * is a state of the volume, not of the series.
 */
@Service
@Transactional
public class WorkFollowing {

    private final FollowedWorkRepository followedWorkRepository;
    private final WishlistEntryRepository wishlistEntryRepository;
    private final OwnershipRepository ownershipRepository;
    private final EntityRepository entityRepository;

    public WorkFollowing(FollowedWorkRepository followedWorkRepository,
                         WishlistEntryRepository wishlistEntryRepository,
                         OwnershipRepository ownershipRepository,
                         EntityRepository entityRepository) {
        this.followedWorkRepository = followedWorkRepository;
        this.wishlistEntryRepository = wishlistEntryRepository;
        this.ownershipRepository = ownershipRepository;
        this.entityRepository = entityRepository;
    }

    /** Idempotent: following twice is following. */
    public FollowedWork follow(UUID entityId) {
        if (entityId == null || entityRepository.findById(entityId).isEmpty()) {
            throw new IllegalArgumentException("Entité introuvable : " + entityId);
        }
        wishlistEntryRepository.findByEntityId(entityId)
                .ifPresent(envie -> wishlistEntryRepository.deleteById(envie.id()));
        return followedWorkRepository.findByEntityId(entityId)
                .orElseGet(() -> followedWorkRepository.save(FollowedWork.follow(entityId, LocalDate.now())));
    }

    public void unfollow(UUID entityId) {
        followedWorkRepository.deleteByEntityId(entityId);
    }

    public boolean isFollowed(UUID entityId) {
        return followedWorkRepository.findByEntityId(entityId).isPresent();
    }

    /** Wanting the WHOLE work - not a volume - means no longer following it. */
    public void wantedAsAWhole(UUID entityId) {
        followedWorkRepository.deleteByEntityId(entityId);
    }

    /**
     * Owning the work as a SINGLE PIECE (an ownership without a volume): it is
     * owned, so no longer followed. An ownership of a volume does not go through here.
     */
    @EventListener
    public void onOwnershipAdded(OwnershipAdded event) {
        boolean oeuvreEntiere = ownershipRepository.findByEntityId(event.entityId()).stream()
                .anyMatch(o -> o.id().equals(event.ownershipId()) && o.variantId().isEmpty());
        if (oeuvreEntiere) {
            followedWorkRepository.deleteByEntityId(event.entityId());
        }
    }
}
