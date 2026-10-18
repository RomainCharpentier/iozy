package com.iozycore.core.api.dto;

/**
 * Space sharing, on the owner side. What a visitor receives is
 * {@link com.iozycore.core.application.share.SharedSpace}.
 */
public final class ShareDtos {

    private ShareDtos() {
    }

    /** State of the link on the owner side - {@code token} null = no active link. */
    public record ShareResponse(String token, boolean shareCollection, boolean shareWishlist,
                                 boolean includeTierLists) {
    }

    /**
     * Change of the visible sections. Each field is optional:
     * {@code null} = "do not change", which lets the Wishes screen
     * touch only the wishes without knowing anything about the collection.
     */
    public record UpdateShareRequest(Boolean shareCollection, Boolean shareWishlist, Boolean includeTierLists) {
    }
}
