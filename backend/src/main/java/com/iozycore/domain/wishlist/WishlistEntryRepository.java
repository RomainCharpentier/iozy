package com.iozycore.domain.wishlist;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface WishlistEntryRepository {

    WishlistEntry save(WishlistEntry entry);

    Optional<WishlistEntry> findByEntityId(UUID entityId);

    /** Utilisé par le Bounded Context Insights (étape 8) pour calculer les statistiques. */
    List<WishlistEntry> findAll();

    void deleteById(UUID id);
}
