package com.iozycore.core.domain.wishlist;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface WishlistEntryRepository {

    WishlistEntry save(WishlistEntry entry);

    /** The wish about the whole WORK (variantId empty) - types without volumes. */
    Optional<WishlistEntry> findByEntityId(UUID entityId);

    /** The wish about THIS specific volume. */
    Optional<WishlistEntry> findByVariantId(UUID variantId);

    /** All wishes of a work, volumes included - what the detail page shows. */
    List<WishlistEntry> findAllByEntityId(UUID entityId);

    /** Used by the Insights Bounded Context (step 8) to compute the statistics. */
    List<WishlistEntry> findAll();

    /** Removes an entry (see the life cycle described on {@link WishlistEntry}). Idempotent by contract:
     * an id already deleted or unknown is never an error, never an exception - only the state "this
     * entry is no longer in the wishlist" counts, whether it was just deleted or already was
     * (double click, outdated tile after a late reload, etc.). Never affects the Entity,
     * the MangaEdition, the Variant or the Ownership targeted by this entry - WishlistEntry only carries an
     * entityId as a plain value, without a JPA relation, so no cascade is possible on the catalog/collection side. */
    void deleteById(UUID id);
}
