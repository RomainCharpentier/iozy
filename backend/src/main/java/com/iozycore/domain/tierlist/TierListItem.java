package com.iozycore.domain.tierlist;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

/**
 * Appartenance d'une Entity à une TierList personnalisée, avec un rang
 * optionnel (voir la maquette V1.2 - "voir les non classés" : un élément
 * peut être ajouté à une Tier List avant d'être classé, `rank` reste alors
 * null). Contrairement à EntityRank (classement général), l'appartenance
 * ici est toujours explicite - jamais dérivée de la possession seule.
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

    /** `null` = retire l'élément du classement de cette liste sans le retirer de la liste elle-même (redevient "non classé"). */
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
