package com.iozycore.core.domain.wishlist;

import com.iozycore.core.domain.shared.DomainEvent;

import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Racine d'agrégat représentant le souhait d'acquérir un objet collectionnable.
 * Cycle de vie propre : ajoutée, retirée, ou convertie en Ownership
 * (la conversion elle-même est orchestrée en couche application, qui
 * crée l'Ownership puis supprime l'entrée de wishlist).
 * <p>
 * Porte un ownerId, mais ne le CHOISIT pas : à la création il vaut
 * null - « pas encore attribué ». C'est la session qui
 * tranche, à l'écriture, via la colonne marquée @TenantId (voir
 * ProprietaireCourant). Relu depuis la base, il porte le vrai propriétaire
 * de la ligne.
 * <p>
 * <b>Sur quoi porte une envie.</b> Sur l'objet réellement collectionnable du
 * type, pas sur son groupe (voir l'étude produit du 2026-08-27). Pour un
 * manga, c'est le TOME : « veux-tu Naruto ? » n'a pas de réponse utile quand
 * il en manque trente. Pour un type sans notion de tome (jeu vidéo, jeu de
 * société), l'œuvre EST l'objet collectionnable et {@code variantId} reste
 * vide - exactement comme {@code Ownership.variantId}, vide pour la même
 * raison.
 * <p>
 * <b>Exclusive de la possession.</b> Vouloir et avoir sont deux états d'un
 * même objet, jamais deux états superposés : la règle est tenue en couche
 * application (voir WishlistController à l'ajout, QuickAddService à
 * l'acquisition), là où les deux dépôts sont visibles à la fois.
 */
public class WishlistEntry {

    private final UUID id;
    private final UUID entityId;
    private final UUID variantId;
    private final UUID ownerId;
    private final LocalDate addedAt;
    private final List<DomainEvent> pendingEvents = new ArrayList<>();

    private WishlistEntry(UUID id, UUID entityId, UUID variantId, UUID ownerId, LocalDate addedAt) {
        this.id = id;
        this.entityId = entityId;
        this.variantId = variantId;
        this.ownerId = ownerId;
        this.addedAt = addedAt;
    }

    /** Envie portant sur un TOME précis - le cas normal pour un manga. */
    public static WishlistEntry addVariant(UUID entityId, UUID variantId, LocalDate addedAt) {
        if (variantId == null) {
            throw new IllegalArgumentException("Une envie de tome doit référencer le tome voulu");
        }
        return creer(entityId, variantId, addedAt);
    }

    /** Envie portant sur l'ŒUVRE entière - réservée aux types sans notion de
     *  tome, où l'œuvre est elle-même l'objet collectionnable. */
    public static WishlistEntry add(UUID entityId, LocalDate addedAt) {
        return creer(entityId, null, addedAt);
    }

    private static WishlistEntry creer(UUID entityId, UUID variantId, LocalDate addedAt) {
        // Sans cette garde, un corps sans entityId descendait jusqu'à Hibernate,
        // qui remontait sa violation de contrainte en 500 (Lot 28). Seule
        // reconstitute() reste sans contrôle : elle relit ce que la base contient
        // déjà, elle ne crée rien.
        if (entityId == null) {
            throw new IllegalArgumentException("Une entrée de wishlist doit référencer une œuvre");
        }
        WishlistEntry entry = new WishlistEntry(UUID.randomUUID(), entityId, variantId, null, addedAt);
        entry.pendingEvents.add(new EntityAddedToWishlist(entry.id, entityId, Instant.now()));
        return entry;
    }

    public static WishlistEntry reconstitute(UUID id, UUID entityId, UUID variantId, UUID ownerId, LocalDate addedAt) {
        return new WishlistEntry(id, entityId, variantId, ownerId, addedAt);
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

    /** Le tome voulu, vide quand l'envie porte sur l'œuvre entière. */
    public Optional<UUID> variantId() {
        return Optional.ofNullable(variantId);
    }

    public UUID ownerId() {
        return ownerId;
    }

    public LocalDate addedAt() {
        return addedAt;
    }
}
