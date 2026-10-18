package com.iozycore.core.domain.tierlist;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

/**
 * Membership of an Entity in a custom TierList, with an optional
 * rank (see mockup V1.2 - "see the unranked": an item
 * can be added to a Tier List before being ranked, `rank` is then
 * null). Unlike EntityRank (general ranking), membership
 * here is always explicit - never derived from ownership alone.
 */
public class TierListItem {

    private final UUID id;
    private final UUID tierListId;
    private final UUID entityId;
    private Rank rank;
    private final Instant addedAt;

    private TierListItem(UUID id, UUID tierListId, UUID entityId, Rank rank, Instant addedAt) {
        this.id = id;
        this.tierListId = tierListId;
        this.entityId = entityId;
        this.rank = rank;
        this.addedAt = addedAt;
    }

    public static TierListItem add(UUID tierListId, UUID entityId) {
        return new TierListItem(UUID.randomUUID(), tierListId, entityId, null, Instant.now());
    }

    public static TierListItem reconstitute(UUID id, UUID tierListId, UUID entityId, Rank rank, Instant addedAt) {
        return new TierListItem(id, tierListId, entityId, rank, addedAt);
    }

    /** `null` = removes the item from the ranking of this list without removing it from the list itself (becomes "unranked" again). */
    public void setRank(Rank rank) {
        this.rank = rank;
    }

    public UUID id() {
        return id;
    }

    public UUID tierListId() {
        return tierListId;
    }

    public UUID entityId() {
        return entityId;
    }

    public Optional<Rank> rank() {
        return Optional.ofNullable(rank);
    }

    public Instant addedAt() {
        return addedAt;
    }
}
