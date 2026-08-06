package com.iozycore.domain.ownership;

import com.iozycore.domain.shared.DefaultOwner;
import com.iozycore.domain.shared.DomainEvent;

import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Racine d'agrégat représentant la possession d'un exemplaire d'une
 * Entity (ou d'un Variant précis). Ne référence jamais une Experience
 * et sa suppression n'affecte jamais l'Entity qu'elle référence.
 * <p>
 * Volontairement simplifié suite aux échanges de conception : pas de
 * prix d'acquisition, pas de statut "prêté" — seulement possédé/vendu/perdu.
 * <p>
 * Porte un ownerId (DefaultOwner.ID tant qu'aucun vrai système
 * multi-utilisateur n'existe) - préparation au multi-utilisateur, voir
 * DefaultOwner.
 */
public class Ownership {

    private final UUID id;
    private final UUID entityId;
    private final UUID variantId; // nullable : possession sans édition précise
    private final UUID ownerId;
    private OwnershipCondition condition;
    private OwnershipStatus status;
    private final LocalDate acquiredAt;
    private String note;
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
                UUID.randomUUID(), entityId, variantId, DefaultOwner.ID, condition, acquiredAt, note);
        ownership.pendingEvents.add(new OwnershipAdded(ownership.id, entityId, Instant.now()));
        return ownership;
    }

    public static Ownership reconstitute(UUID id, UUID entityId, UUID variantId, UUID ownerId,
                                          OwnershipCondition condition, OwnershipStatus status,
                                          LocalDate acquiredAt, String note) {
        Ownership ownership = new Ownership(id, entityId, variantId, ownerId, condition, acquiredAt, note);
        ownership.status = status;
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

    public void updateCondition(OwnershipCondition newCondition) {
        this.condition = newCondition;
    }

    public void updateNote(String newNote) {
        this.note = newNote;
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
}
