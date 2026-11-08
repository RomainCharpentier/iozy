package com.iozycore.core.application.share;

import java.math.BigDecimal;
import java.time.Instant;
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
 *
 * <h2>Lot 217</h2>
 * The pinned works add titles and counts, like the collection. The value is a
 * single total, opt-in and held back below a threshold of prices. A gift list
 * ({@code giftList}) carries the wishes only, and says until when it answers
 * ({@code expiresAt}, null for the share link, which does not expire).
 */
public record SharedSpace(List<SharedUniverse> collection, List<SharedWishlistItem> wishlist,
                          SharedTierLists tierLists, List<SharedPinnedWork> pinned, SharedValue value,
                          boolean giftList, Instant expiresAt) {

    /**
     * "Mes 4 incontournables" (lot 217), in the order chosen: only works really
     * owned, and only when the collection is shared ({@code null} otherwise).
     *
     * @param totalCount known total of the work, null if unknown (never guessed)
     */
    public record SharedPinnedWork(String title, String coverImageUrl, int ownedCount, Integer totalCount) {
    }

    /**
     * The value of the collection (lot 217): only when the owner turned it on
     * AND it rests on enough prices ({@link com.iozycore.core.domain.share.ValueDisclosure}).
     * {@code null} otherwise - never a total built on two prices. The two counts
     * say what the number rests on; no single price ever comes out.
     */
    public record SharedValue(BigDecimal totalKnownValue, long pricedCount, long totalCount) {
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
