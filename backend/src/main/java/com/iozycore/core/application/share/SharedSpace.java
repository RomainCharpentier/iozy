package com.iozycore.core.application.share;

import java.time.LocalDate;
import java.util.List;

/**
 * What a visitor of a share link receives, serialized as is.
 * <p>
 * The sections that are not shared are {@code null}, never empty: {@code []}
 * would say "shared, but nothing in it", which is a fact about the person;
 * {@code null} only says "you do not have access to it".
 *
 * <h2>What is deliberately absent</h2>
 * No id (entityId, variantId, tierListId...) nor deep link: the holder of the
 * link must only reach this page. No price paid, no estimated value, no
 * acquisition date, no rating or personal comment, no tag, no relationship, no
 * history, no purchase analysis, no recorded price, no account information.
 * These records are built field by field from the domain, never an internal
 * model serialized as is. Any addition here must redo this reasoning.
 */
public record SharedSpace(List<SharedUniverse> collection, List<SharedWishlistItem> wishlist,
                          SharedTierLists tierLists) {

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
