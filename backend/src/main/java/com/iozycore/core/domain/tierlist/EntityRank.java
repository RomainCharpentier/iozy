package com.iozycore.core.domain.tierlist;


import java.time.Instant;
import java.util.UUID;

/**
 * GENERAL rank of a work (see mockup V1.2, §45 - "General tier...
 * Mangas / Video games / Board games / Books", always on the
 * full S-F scale). One row = one ranked Entity; "unranked" = no
 * row, never a stored null rank (see TierListRepository on the
 * application side for the computation of the "to rank" queue - every
 * owned Entity without an associated EntityRank).
 * <p>
 * Unlike TierListItem, no notion of explicit membership:
 * every owned work is an implicit candidate for the general ranking
 * (see the mockup - "Rank quickly" goes straight through the
 * owned unranked works, not a list to build first).
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
        return new EntityRank(entityId, null, rank, Instant.now());
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
