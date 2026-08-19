package com.iozycore.domain.tierlist;

import com.iozycore.domain.shared.DefaultOwner;

import java.time.Instant;
import java.util.UUID;

/**
 * Rang GÉNÉRAL d'une œuvre (voir la maquette V1.2, §45 - "Tier générale...
 * Mangas / Jeux vidéo / Jeux de société / Livres", toujours sur l'échelle
 * complète S-F). Une ligne = une Entity classée ; "non classé" = absence de
 * ligne, jamais un rang null stocké (voir TierListRepository côté
 * application pour le calcul de la file d'attente "à classer" - toute
 * Entity possédée sans EntityRank associée).
 * <p>
 * Contrairement à TierListItem, aucune notion d'appartenance explicite :
 * toute œuvre possédée est un candidat implicite au classement général
 * (voir la maquette - "Classer rapidement" parcourt directement les
 * œuvres possédées non classées, pas une liste à constituer d'abord).
 */
public class EntityRank {

    private final UUID entityId;
    private final UUID ownerId;
    private Rank rank;
    private Instant rankedAt;

    private EntityRank(UUID entityId, UUID ownerId, Rank rank, Instant rankedAt) {
        if (rank == null) {
            throw new IllegalArgumentException("Un EntityRank existant porte toujours un rang - voir la suppression pour \"non classé\"");
        }
        this.entityId = entityId;
        this.ownerId = ownerId;
        this.rank = rank;
        this.rankedAt = rankedAt;
    }

    public static EntityRank assign(UUID entityId, Rank rank) {
        return new EntityRank(entityId, DefaultOwner.ID, rank, Instant.now());
    }

    public static EntityRank reconstitute(UUID entityId, UUID ownerId, Rank rank, Instant rankedAt) {
        return new EntityRank(entityId, ownerId, rank, rankedAt);
    }

    public void updateRank(Rank rank) {
        if (rank == null) {
            throw new IllegalArgumentException("Utilise la suppression pour repasser une œuvre \"non classée\"");
        }
        this.rank = rank;
        this.rankedAt = Instant.now();
    }

    public UUID entityId() {
        return entityId;
    }

    public UUID ownerId() {
        return ownerId;
    }

    public Rank rank() {
        return rank;
    }

    public Instant rankedAt() {
        return rankedAt;
    }
}
