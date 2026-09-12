package com.iozycore.core.domain.follow;

import java.time.LocalDate;
import java.util.UUID;

/**
 * Une œuvre SUIVIE : celle dont on attend les sorties.
 *
 * <p>Le troisième état d'une œuvre pour un collectionneur, à côté de Possédé
 * (voir Ownership) et Envie (voir WishlistEntry) - une trinité où chaque
 * état est unique (retour utilisateur du 2026-09-11). Posséder dit ce qu'on
 * a, vouloir ce qu'on aimerait, suivre ce qu'on collectionne au fil des
 * parutions : c'est l'œuvre suivie, et elle seule, qui entre au calendrier
 * des sorties. Un tome d'une série suivie peut rester possédé ou à acheter :
 * l'état vaut pour l'œuvre, la sortie dit le reste.
 *
 * <p>Un concept du CŒUR, pour tout type : le manga y ajoute son édition
 * suivie, qui dit LAQUELLE de ses éditions on collectionne.
 *
 * <p>Le propriétaire n'est pas connu du domaine : Hibernate le pose à
 * l'insertion depuis la session (voir {@code @TenantId} côté persistance),
 * comme pour une envie ou une possession.
 */
public class FollowedWork {

    private final UUID id;
    private final UUID entityId;
    private final UUID ownerId;
    private final LocalDate followedAt;

    private FollowedWork(UUID id, UUID entityId, UUID ownerId, LocalDate followedAt) {
        this.id = id;
        this.entityId = entityId;
        this.ownerId = ownerId;
        this.followedAt = followedAt;
    }

    public static FollowedWork follow(UUID entityId, LocalDate followedAt) {
        if (entityId == null) {
            throw new IllegalArgumentException("Suivre une œuvre demande de la désigner");
        }
        return new FollowedWork(UUID.randomUUID(), entityId, null, followedAt == null ? LocalDate.now() : followedAt);
    }

    public static FollowedWork reconstitute(UUID id, UUID entityId, UUID ownerId, LocalDate followedAt) {
        return new FollowedWork(id, entityId, ownerId, followedAt);
    }

    public UUID id() {
        return id;
    }

    public UUID entityId() {
        return entityId;
    }

    public UUID ownerId() {
        return ownerId;
    }

    public LocalDate followedAt() {
        return followedAt;
    }
}
