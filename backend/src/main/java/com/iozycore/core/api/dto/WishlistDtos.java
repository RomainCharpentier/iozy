package com.iozycore.core.api.dto;

import com.iozycore.core.domain.wishlist.WishlistEntry;

import java.time.LocalDate;
import java.util.Map;
import java.util.UUID;

public final class WishlistDtos {

    private WishlistDtos() {
    }

    /**
     * Two accepted shapes, never mixed:
     * <ul>
     *   <li><b>{@code entityId}</b> - the work is already an IozyCore catalog
     *       page (detail page, local result, recognized scan).</li>
     *   <li><b>{@code entityTypeId} + {@code title}</b> (+ optional {@code attributes}
     *       ) - the work comes from an external source and has no
     *       page yet. The backend resolves or creates it, WITHOUT ownership, and
     *       returns its canonical internal identity.</li>
     * </ul>
     * The client therefore does not have to know the internal process nor to orchestrate
     * two calls: it sends what it has.
     * <p>
     * <b>Which item is wanted</b>, once the work is identified - three shapes,
     * from the most precise to the widest:
     * <ul>
     *   <li><b>{@code variantId}</b> - that volume, already cataloged.</li>
     *   <li><b>{@code volumeNumber}</b> (+ {@code edition}) - volume N of
     *       this edition, cataloged or not. This is the normal shape from a
     *       detail page: most missing volumes are only deduced there from the
     *       total of the edition, never cataloged (see TomeResolver).</li>
     *   <li><b>neither of the two</b> - the whole work, which only makes sense
     *       for a type with no notion of volume (game, board game).</li>
     * </ul>
     */
    public record AddToWishlistRequest(UUID entityId, UUID variantId, Integer volumeNumber, String edition,
                                        UUID entityTypeId, String title, Map<String, Object> attributes) {
    }

    /** `variantId` carries the wanted VOLUME, null when the wish targets the
     *  whole work (type with no notion of volume) - see WishlistEntry. */
    public record WishlistEntryResponse(UUID id, UUID entityId, UUID variantId, LocalDate addedAt) {
        public static WishlistEntryResponse from(WishlistEntry entry) {
            return new WishlistEntryResponse(entry.id(), entry.entityId(), entry.variantId().orElse(null), entry.addedAt());
        }
    }

    /** Answer of path 3 (check before purchase): owned / in wishlist / unknown. */
    public record LookupResponse(String status) {
        public static final LookupResponse UNKNOWN = new LookupResponse("UNKNOWN");
        public static final LookupResponse WISHLISTED = new LookupResponse("WISHLISTED");
        public static final LookupResponse OWNED = new LookupResponse("OWNED");
    }
}
