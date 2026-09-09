package com.iozycore.core.insights;

import com.iozycore.core.domain.catalog.Entity;
import com.iozycore.core.domain.catalog.EntityType;
import com.iozycore.core.domain.ownership.Ownership;
import com.iozycore.core.domain.wishlist.WishlistEntry;

import java.time.LocalDate;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

/**
 * Ce que le cœur a lu pour une catégorie avant de demander ses sorties à un
 * univers : les œuvres qui intéressent l'utilisateur (possédées ou en envie),
 * leurs possessions actives et leurs envies.
 *
 * <p>Lu une fois par catégorie, et passé tel quel à chaque source : sur 300
 * séries, un univers qui relirait les possessions œuvre par œuvre coûterait
 * 300 requêtes (mesure du lot 141 sur Découvrir). Ici tout est déjà en
 * mémoire, indexé par œuvre.
 */
public record ReleaseContext(EntityType entityType, LocalDate from, LocalDate to, List<Entity> entities,
                              List<Ownership> activeOwnerships, List<WishlistEntry> wishlist) {

    public ReleaseContext {
        entities = List.copyOf(entities);
        activeOwnerships = List.copyOf(activeOwnerships);
        wishlist = List.copyOf(wishlist);
    }

    /** Les identifiants de tome (Variant) possédés, par œuvre - vide pour une possession de l'œuvre entière. */
    public Map<UUID, Set<UUID>> ownedVariantIdsByEntity() {
        Map<UUID, Set<UUID>> result = new HashMap<>();
        for (Ownership ownership : activeOwnerships) {
            Set<UUID> variants = result.computeIfAbsent(ownership.entityId(), id -> new HashSet<>());
            ownership.variantId().ifPresent(variants::add);
        }
        return result;
    }

    public boolean isOwned(UUID entityId) {
        return activeOwnerships.stream().anyMatch(ownership -> ownership.entityId().equals(entityId));
    }

    /** L'œuvre entière est voulue (une envie sans tome précis). */
    public boolean isWanted(UUID entityId) {
        return wishlist.stream().anyMatch(entry -> entry.entityId().equals(entityId) && entry.variantId().isEmpty());
    }

    /** Les tomes précis voulus, par œuvre. */
    public Map<UUID, Set<UUID>> wantedVariantIdsByEntity() {
        Map<UUID, Set<UUID>> result = new HashMap<>();
        for (WishlistEntry entry : wishlist) {
            entry.variantId().ifPresent(variantId ->
                    result.computeIfAbsent(entry.entityId(), id -> new HashSet<>()).add(variantId));
        }
        return result;
    }

    /** La relation d'une œuvre entière à la collection - possédée d'abord, voulue sinon. */
    public Optional<ReleaseEntry.Relation> relationOf(UUID entityId) {
        if (isOwned(entityId)) {
            return Optional.of(ReleaseEntry.Relation.OWNED);
        }
        if (isWanted(entityId) || wantedVariantIdsByEntity().containsKey(entityId)) {
            return Optional.of(ReleaseEntry.Relation.WANTED);
        }
        return Optional.empty();
    }
}
