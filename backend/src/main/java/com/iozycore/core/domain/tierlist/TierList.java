package com.iozycore.core.domain.tierlist;


import java.time.Instant;
import java.util.EnumSet;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

/**
 * Aggregate root for a custom ranking (see the
 * mockup V1.2, "New Tier List" - name, universe/type, active ranks,
 * optional description). Attached to ONE SINGLE EntityType (universe) in
 * the usual case - the GENERAL ranking always applies this
 * rule too (see EntityRank: "Mangas" and "Video games" each have their
 * own scale).
 * <p>
 * {@code entityTypeId} null = CROSS-CUTTING Tier List, "all categories"
 * (scope 'all' of the mockup): it accepts works from any
 * universe. This is the only case where mixing is wanted, and it is always
 * explicit - never the default of a list whose universe was forgotten
 * (see the dedicated field of CreateTierListModal on the web side).
 * <p>
 * The GENERAL ranking (one rank per work, always on the full
 * S-F scale) is NOT a TierList: see EntityRank, which is simpler
 * (each owned entity is an implicit candidate, no need for an explicit
 * addition as here). This class only covers custom Tier Lists,
 * whose membership is always voluntary (see
 * TierListItem).
 * <p>
 * Carries an ownerId, but does not CHOOSE it: null at creation, the session
 * decides at write time through the column marked @TenantId (see
 * ProprietaireCourant). Same rule as Ownership.
 */
public class TierList {

    private final UUID id;
    private final UUID ownerId;
    private String name;
    private final UUID entityTypeId;
    private Set<Rank> activeRanks;
    private String description;
    private final Instant createdAt;

    private TierList(UUID id, UUID ownerId, String name, UUID entityTypeId, Set<Rank> activeRanks,
                      String description, Instant createdAt) {
        if (name == null || name.isBlank()) {
            throw new IllegalArgumentException("Le nom de la Tier List ne peut pas être vide");
        }
        if (activeRanks == null || activeRanks.isEmpty()) {
            throw new IllegalArgumentException("Une Tier List doit avoir au moins un rang actif");
        }
        this.id = id;
        this.ownerId = ownerId;
        this.name = name;
        this.entityTypeId = entityTypeId;
        this.activeRanks = EnumSet.copyOf(activeRanks);
        this.description = description;
        this.createdAt = createdAt;
    }

    /** Default active ranks = the full scale (see the mockup - a
     * custom Tier List can then turn some off, never
     * the opposite of an empty default).
     *
     * @param entityTypeId universe of the list, {@code null} for a
     *                     cross-cutting "all categories" list (see class javadoc). */
    public static TierList create(String name, UUID entityTypeId, Set<Rank> activeRanks, String description) {
        Set<Rank> ranks = (activeRanks == null || activeRanks.isEmpty()) ? EnumSet.allOf(Rank.class) : activeRanks;
        return new TierList(UUID.randomUUID(), null, name.trim(), entityTypeId, ranks,
                blankToNull(description), Instant.now());
    }

    public static TierList reconstitute(UUID id, UUID ownerId, String name, UUID entityTypeId, Set<Rank> activeRanks,
                                         String description, Instant createdAt) {
        return new TierList(id, ownerId, name, entityTypeId, activeRanks, description, createdAt);
    }

    public void rename(String name) {
        if (name == null || name.isBlank()) {
            throw new IllegalArgumentException("Le nom de la Tier List ne peut pas être vide");
        }
        this.name = name.trim();
    }

    public void updateActiveRanks(Set<Rank> activeRanks) {
        if (activeRanks == null || activeRanks.isEmpty()) {
            throw new IllegalArgumentException("Une Tier List doit avoir au moins un rang actif");
        }
        this.activeRanks = EnumSet.copyOf(activeRanks);
    }

    public void updateDescription(String description) {
        this.description = blankToNull(description);
    }

    private static String blankToNull(String value) {
        return (value == null || value.isBlank()) ? null : value.trim();
    }

    public UUID id() {
        return id;
    }

    public UUID ownerId() {
        return ownerId;
    }

    public String name() {
        return name;
    }

    /** Empty = cross-cutting "all categories" Tier List (see class javadoc). */
    public Optional<UUID> entityTypeId() {
        return Optional.ofNullable(entityTypeId);
    }

    /** All categories together - a work of any universe can enter it. */
    public boolean isAllUniverses() {
        return entityTypeId == null;
    }

    public Set<Rank> activeRanks() {
        return EnumSet.copyOf(activeRanks);
    }

    public Optional<String> description() {
        return Optional.ofNullable(description);
    }

    public Instant createdAt() {
        return createdAt;
    }
}
