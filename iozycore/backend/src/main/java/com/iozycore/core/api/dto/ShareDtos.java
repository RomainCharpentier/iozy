package com.iozycore.core.api.dto;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Space sharing, on the owner side. What a visitor receives is
 * {@link com.iozycore.core.application.share.SharedSpace}.
 */
public final class ShareDtos {

    private ShareDtos() {
    }

    /**
     * State of the link on the owner side - {@code token} null = no active link.
     *
     * @param showValue       the value of the collection on the public page (lot 217);
     *                        it still only comes out above the threshold of prices
     * @param pinnedWorkIds   "Mes 4 incontournables", in order (lot 217)
     * @param giftLink        the gift list link, null when there is none (lot 217)
     */
    public record ShareResponse(String token, boolean shareCollection, boolean shareWishlist,
                                boolean includeTierLists, boolean showValue, List<UUID> pinnedWorkIds,
                                GiftLinkResponse giftLink) {

        /** The four first fields only, as before lot 217. */
        public ShareResponse(String token, boolean shareCollection, boolean shareWishlist, boolean includeTierLists) {
            this(token, shareCollection, shareWishlist, includeTierLists, false, List.of(), null);
        }
    }

    /**
     * The gift list link. {@code expired}: past {@code expiresAt}, the public page
     * says "Ce lien a expiré" until it is renewed.
     */
    public record GiftLinkResponse(String token, Instant expiresAt, boolean expired) {
    }

    /**
     * Change of the visible sections. Each field is optional:
     * {@code null} = "do not change", which lets the Wishes screen
     * touch only the wishes without knowing anything about the collection.
     */
    public record UpdateShareRequest(Boolean shareCollection, Boolean shareWishlist, Boolean includeTierLists,
                                     Boolean showValue) {

        public UpdateShareRequest(Boolean shareCollection, Boolean shareWishlist, Boolean includeTierLists) {
            this(shareCollection, shareWishlist, includeTierLists, null);
        }
    }

    /** "Mes 4 incontournables", in order: replaces the whole list. Empty = none. */
    public record PinnedWorksRequest(List<UUID> entityIds) {
    }
}
