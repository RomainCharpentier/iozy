package com.iozycore.api.dto;

import com.iozycore.domain.wishlist.WishlistEntry;

import java.time.LocalDate;
import java.util.UUID;

public final class WishlistDtos {

    private WishlistDtos() {
    }

    public record AddToWishlistRequest(UUID entityId) {
    }

    public record WishlistEntryResponse(UUID id, UUID entityId, LocalDate addedAt) {
        public static WishlistEntryResponse from(WishlistEntry entry) {
            return new WishlistEntryResponse(entry.id(), entry.entityId(), entry.addedAt());
        }
    }

    /** Réponse du parcours 3 (vérification avant achat) : possédé / en wishlist / inconnu. */
    public record LookupResponse(String status) {
        public static final LookupResponse UNKNOWN = new LookupResponse("UNKNOWN");
        public static final LookupResponse WISHLISTED = new LookupResponse("WISHLISTED");
        public static final LookupResponse OWNED = new LookupResponse("OWNED");
    }
}
