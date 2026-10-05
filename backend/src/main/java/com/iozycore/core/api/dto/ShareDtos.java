package com.iozycore.core.api.dto;

import java.time.LocalDate;
import java.util.List;

/**
 * Space sharing, on the owner side and on the visitor side.
 *
 * <h2>What the public view deliberately does not expose</h2>
 * No id (entityId, variantId, tierListId...) nor deep link: the
 * holder of the link must only be able to reach this page, never the rest of
 * the application. No price paid, no estimated value, no
 * acquisition date, no rating or personal comment, no tag, no
 * relationship, no history, no purchase analysis, no recorded price.
 * No account information either - there is no pseudo nor
 * avatar in the model anyway, and this pass does not invent any.
 * <p>
 * It is the <b>backend</b> that filters: these records are built
 * field by field from the domain, never an internal model serialized as
 * is that a client would hide afterwards. Any addition here must redo this
 * reasoning.
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

    /**
     * What a visitor receives. The sections that are not shared are <b>absent</b>
     * ({@code null}), not empty: an empty section would say "shared, but nothing
     * in it", which is different information - and the client then does not
     * even have what it takes to show an inaccessible tab.
     */
    public record SharedSpaceResponse(List<SharedUniverse> collection, List<SharedWishlistItem> wishlist,
                                       SharedTierLists tierLists) {
    }

    public record SharedUniverse(String label, List<SharedCollectionItem> items) {
    }

    /**
     * @param editions         editions really owned of this work (often only one,
     *                         empty when none is given)
     * @param ownedVolumeCount number of DISTINCT volumes owned - 0 for a work owned
     *                         without a specific volume (game, one-shot without a number)
     * @param totalVolumes     known total of the series, null if unknown: the progress is
     *                         then not shown rather than guessed
     */
    public record SharedCollectionItem(String title, String coverImageUrl, List<String> editions,
                                        int ownedVolumeCount, Integer totalVolumes) {
    }

    /** A wish: enough to recognize it to give it, nothing more. */
    public record SharedWishlistItem(String title, String coverImageUrl, LocalDate addedAt) {
    }

    /** @param general general ranking per universe ; @param custom named Tier Lists. */
    public record SharedTierLists(List<SharedTierBoard> general, List<SharedTierBoard> custom) {
    }

    public record SharedTierBoard(String label, List<SharedTierRow> rows) {
    }

    public record SharedTierRow(String rank, List<SharedRankedItem> items) {
    }

    public record SharedRankedItem(String title, String coverImageUrl) {
    }
}
