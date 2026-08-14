package com.iozycore.purchaseanalysis;

import com.iozycore.domain.catalog.MangaEditionRepository;

import java.util.Set;

/**
 * One series within a listing (a multi-series lot has one {@link ListingItem}
 * per series - see the specification's worked example: 20th Century Boys +
 * 21st Century Boys + Sanctuary in a single Vinted listing).
 *
 * @param editionNameRaw   free-text edition name as typed by the user, resolved against
 *                         {@link MangaEditionRepository} by {@link PurchaseAnalysisService}
 * @param includedVolumes  volume numbers included in the listing for this series/edition,
 *                         already expanded from any {@link VolumeRange}s entered
 * @param itemConditionOverride condition specific to this item, if it differs from the listing's
 *                              overall condition - nullable, falls back to {@link Listing#condition()}
 */
public record ListingItem(MangaSeries series, String editionNameRaw, Set<Integer> includedVolumes,
                           Condition itemConditionOverride) {
    public ListingItem {
        if (editionNameRaw == null || editionNameRaw.isBlank()) {
            throw new IllegalArgumentException("An edition name is required for each listing item");
        }
        if (includedVolumes == null || includedVolumes.isEmpty()) {
            throw new IllegalArgumentException("A listing item must include at least one volume");
        }
        includedVolumes = Set.copyOf(includedVolumes);
    }
}
