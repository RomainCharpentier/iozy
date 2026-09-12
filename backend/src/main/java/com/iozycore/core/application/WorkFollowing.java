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
 * Suivre une œuvre, et tenir la règle « un état à la fois ».
 *
 * <p>Possédé, Suivi, Envie : une trinité où chaque état est unique (retour
 * utilisateur du 2026-09-11). Ce service est le seul endroit qui connaît les
 * passages de l'un à l'autre, pour l'ŒUVRE :
 * <ul>
 *   <li>suivre retire l'envie de l'œuvre ;</li>
 *   <li>vouloir l'œuvre entière la retire des suivies (voir WishlistController) ;</li>
 *   <li>posséder l'œuvre d'une pièce la retire des suivies (voir l'événement
 *       OwnershipAdded).</li>
 * </ul>
 * Un TOME ne change rien à l'état de sa série : acquérir le tome 12 d'une
 * série suivie est exactement ce que suivre veut dire, et vouloir le tome 13
 * est un état du tome, pas de la série.
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

    /** Idempotent : suivre deux fois, c'est suivre. */
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

    /** Vouloir l'œuvre ENTIÈRE - pas un tome - c'est ne plus la suivre. */
    public void wantedAsAWhole(UUID entityId) {
        followedWorkRepository.deleteByEntityId(entityId);
    }

    /**
     * Posséder l'œuvre d'une PIÈCE (une possession sans tome) : elle est
     * possédée, donc plus suivie. Une possession de tome ne passe pas par ici.
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
