package com.iozycore.domain.wishlist;

import com.iozycore.domain.shared.DefaultOwner;
import com.iozycore.domain.shared.DomainEvent;

import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Racine d'agrégat représentant le souhait d'acquérir une Entity.
 * Cycle de vie propre : ajoutée, retirée, ou convertie en Ownership
 * (la conversion elle-même est orchestrée en couche application, qui
 * crée l'Ownership puis supprime l'entrée de wishlist).
 * <p>
 * Porte un ownerId (DefaultOwner.ID tant qu'aucun vrai système
 * multi-utilisateur n'existe) - préparation au multi-utilisateur, voir
 * DefaultOwner.
 */
public class WishlistEntry {

    private final UUID id;
    private final UUID entityId;
    private final UUID ownerId;
    private final LocalDate addedAt;
    private final List<DomainEvent> pendingEvents = new ArrayList<>();

    private WishlistEntry(UUID id, UUID entityId, UUID ownerId, LocalDate addedAt) {
        this.id = id;
        this.entityId = entityId;
        this.ownerId = ownerId;
        this.addedAt = addedAt;
    }

    public static WishlistEntry add(UUID entityId, LocalDate addedAt) {
        // Sans cette garde, un corps sans entityId descendait jusqu'à Hibernate,
        // qui remontait sa violation de contrainte en 500 (Lot 28). Seule
        // reconstitute() reste sans contrôle : elle relit ce que la base contient
        // déjà, elle ne crée rien.
        if (entityId == null) {
            throw new IllegalArgumentException("Une entrée de wishlist doit référencer une œuvre");
        }
        WishlistEntry entry = new WishlistEntry(UUID.randomUUID(), entityId, DefaultOwner.ID, addedAt);
        entry.pendingEvents.add(new EntityAddedToWishlist(entry.id, entityId, Instant.now()));
        return entry;
    }

    public static WishlistEntry reconstitute(UUID id, UUID entityId, UUID ownerId, LocalDate addedAt) {
        return new WishlistEntry(id, entityId, ownerId, addedAt);
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

    public UUID ownerId() {
        return ownerId;
    }

    public LocalDate addedAt() {
        return addedAt;
    }
}
