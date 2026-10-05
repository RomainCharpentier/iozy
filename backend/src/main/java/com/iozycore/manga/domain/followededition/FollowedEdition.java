package com.iozycore.manga.domain.followededition;


import java.time.LocalDate;
import java.util.UUID;

/**
 * The edition of a series that the user really collects - the
 * "SUIVIE" badge of the mockup "Fiche série (multi-éditions)".
 * <p>
 * Not to be confused with {@code MangaEdition} = the documentation page of an
 * edition (publisher, number of volumes, out of print...). It describes the edition for
 * everyone; this one says what I do with it.
 * <p>
 * Designates the edition by its NAME, never by the id of a {@code MangaEdition}:
 * a series can have volumes in an edition that has no documentation page yet
 * (it is created only when publisher/number
 * of volumes is filled in). Following an edition must not require having
 * documented it first.
 * <p>
 * Carries an ownerId, but does not CHOOSE it: null at creation, the session
 * decides at write time through the column marked @TenantId (see
 * ProprietaireCourant). Same rule as Ownership.
 */
public class FollowedEdition {

    private final UUID id;
    private final UUID entityId;
    private final UUID ownerId;
    private final String editionName;
    private final LocalDate followedAt;

    private FollowedEdition(UUID id, UUID entityId, UUID ownerId, String editionName, LocalDate followedAt) {
        if (editionName == null || editionName.isBlank()) {
            // Following "the unspecified edition" means nothing: it is the
            // catch-all for volumes whose edition is unknown, not an
            // edition one can decide to collect. Guard BEFORE the trim
            // below, so that a body without a name comes out as a 400 rather
            // than a 500.
            throw new IllegalArgumentException("L'édition suivie ne peut pas être vide");
        }
        this.id = id;
        this.entityId = entityId;
        this.ownerId = ownerId;
        this.editionName = editionName.trim();
        this.followedAt = followedAt;
    }

    public static FollowedEdition create(UUID entityId, String editionName) {
        return new FollowedEdition(UUID.randomUUID(), entityId, null, editionName, LocalDate.now());
    }

    public static FollowedEdition reconstitute(UUID id, UUID entityId, UUID ownerId, String editionName,
                                               LocalDate followedAt) {
        return new FollowedEdition(id, entityId, ownerId, editionName, followedAt);
    }

    /**
     * Changes the followed edition while keeping the same row identity - this is what
     * enforces "a single followed edition per series" without ever
     * depending on a DELETE then an INSERT, which would leave a window where the
     * series has none (and would violate the uniqueness constraint if the two
     * orders crossed).
     */
    public FollowedEdition suivreALaPlace(String nouvelleEdition) {
        return new FollowedEdition(id, entityId, ownerId, nouvelleEdition, LocalDate.now());
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

    public String editionName() {
        return editionName;
    }

    public LocalDate followedAt() {
        return followedAt;
    }
}
