package com.iozycore.core.domain.ownership;

import com.iozycore.core.domain.shared.DomainEvent;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Aggregate root for the ownership of one copy of an
 * Entity (or of a specific Variant). Never references an Experience
 * and its deletion never affects the Entity that it references.
 * <p>
 * Purchase price ({@code purchasePrice}) was explicitly out of the
 * scope of the initial MVP ("simplification asked", see
 * docs/CONCEPTION.md §4) - added since on explicit request. The status
 * "lent" followed the opposite path: added then removed from the product, it
 * never lived here but in a separate aggregate, deleted with the
 * feature (see V19__drop_loan.sql). purchasePrice stays nullable and
 * is never guessed: an Ownership created before this feature, or
 * simply added without a price, keeps purchasePrice = null rather than an
 * invented value (see StatsService.computeCollectionValue, which always
 * tells the known coverage apart from the real total instead of implying
 * a complete total value).
 * <p>
 * Carries an ownerId, but does not CHOOSE it: at creation it is
 * null - "not yet assigned". The session decides, at write time,
 * through the column marked @TenantId (see
 * ProprietaireCourant). Read back from the database, it carries the real owner
 * of the row.
 */
public class Ownership {

    private final UUID id;
    private final UUID entityId;
    private final UUID variantId; // nullable: ownership without a specific edition
    private final UUID ownerId;
    private OwnershipCondition condition;
    private OwnershipStatus status;
    private final LocalDate acquiredAt;
    private String note;
    private BigDecimal purchasePrice; // nullable: never guessed, see the class Javadoc
    private final List<DomainEvent> pendingEvents = new ArrayList<>();

    private Ownership(UUID id, UUID entityId, UUID variantId, UUID ownerId, OwnershipCondition condition,
                       LocalDate acquiredAt, String note) {
        this.id = id;
        this.entityId = entityId;
        this.variantId = variantId;
        this.ownerId = ownerId;
        this.condition = condition;
        this.status = OwnershipStatus.OWNED;
        this.acquiredAt = acquiredAt;
        this.note = note;
    }

    public static Ownership acquire(UUID entityId, UUID variantId, OwnershipCondition condition,
                                     LocalDate acquiredAt, String note) {
        Ownership ownership = new Ownership(
                UUID.randomUUID(), entityId, variantId, null, condition, acquiredAt, note);
        ownership.pendingEvents.add(new OwnershipAdded(ownership.id, entityId, Instant.now()));
        return ownership;
    }

    public static Ownership reconstitute(UUID id, UUID entityId, UUID variantId, UUID ownerId,
                                          OwnershipCondition condition, OwnershipStatus status,
                                          LocalDate acquiredAt, String note, BigDecimal purchasePrice) {
        Ownership ownership = new Ownership(id, entityId, variantId, ownerId, condition, acquiredAt, note);
        ownership.status = status;
        ownership.purchasePrice = purchasePrice;
        return ownership;
    }

    private void release(OwnershipStatus newStatus) {
        if (this.status != OwnershipStatus.OWNED) {
            throw new IllegalStateException("Cette Ownership n'est plus active (statut actuel : %s)".formatted(status));
        }
        this.status = newStatus;
        pendingEvents.add(new OwnershipReleased(id, entityId, newStatus, Instant.now()));
    }

    public void markSold() {
        release(OwnershipStatus.SOLD);
    }

    public void markLost() {
        release(OwnershipStatus.LOST);
    }

    /**
     * Puts a sold or lost copy back in ownership.
     * <p>
     * Exists for a precise reason: "Mark as sold" and "Mark as lost" are
     * triggered with a single click from the menu of a copy, and nothing
     * allowed to go back - a slip of the hand made a volume
     * disappear from the collection for good (see
     * docs/USER_JOURNEYS.md, UX-11). The interface now offers "Annuler"
     * right after the action; without this method, this button would be decorative.
     * <p>
     * Refuses a copy that is already active rather than silently doing nothing:
     * calling restore() on a current ownership shows a calling mistake.
     */
    public void restore() {
        if (this.status == OwnershipStatus.OWNED) {
            throw new IllegalStateException("Cette Ownership est déjà active");
        }
        this.status = OwnershipStatus.OWNED;
    }

    public void updateCondition(OwnershipCondition newCondition) {
        this.condition = newCondition;
    }

    public void updateNote(String newNote) {
        this.note = newNote;
    }

    /** {@code null} erases the filled-in price (e.g. corrected entry) - never refused,
     * an Ownership can very well become "unknown price" on purpose. */
    public void updatePurchasePrice(BigDecimal newPurchasePrice) {
        this.purchasePrice = newPurchasePrice;
    }

    public boolean isActive() {
        return status == OwnershipStatus.OWNED;
    }

    public List<DomainEvent> pullDomainEvents() {
        List<DomainEvent> events = List.copyOf(pendingEvents);
        pendingEvents.clear();
        return events;
    }

    public UUID id() {
        return id;
    }

    public UUID entityId() {
        return entityId;
    }

    public Optional<UUID> variantId() {
        return Optional.ofNullable(variantId);
    }

    public UUID ownerId() {
        return ownerId;
    }

    public OwnershipCondition condition() {
        return condition;
    }

    public OwnershipStatus status() {
        return status;
    }

    public LocalDate acquiredAt() {
        return acquiredAt;
    }

    public String note() {
        return note;
    }

    public Optional<BigDecimal> purchasePrice() {
        return Optional.ofNullable(purchasePrice);
    }
}
