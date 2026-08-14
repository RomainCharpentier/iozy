package com.iozycore.purchaseanalysis;

import com.iozycore.domain.catalog.MangaEdition;

import java.math.BigDecimal;
import java.util.List;

/**
 * Per-series breakdown of a {@link PurchaseAnalysis} - required by the
 * specification for any multi-series lot (see the worked example: 20th
 * Century Boys + 21st Century Boys + Sanctuary in one Vinted listing).
 *
 * @param matchedEdition  null when the item's edition is not yet known to the system - triggers
 *                        the inline "fill in reference data" prompt on the client, and every
 *                        downstream field below stays best-effort/null accordingly
 * @param itemCostShare this item's share of the listing's total real cost, prorated by volume count
 * @param duplicates    "Analyse d'un lot" (brainstorm) - which of this item's volumes are already
 *                       owned, see {@link DuplicateAnalysis}
 */
public record ItemAnalysis(ListingItem item, MangaEdition matchedEdition, CollectionStatus completeness,
                            MarketPrice marketPrice, List<Warning> editionWarnings, BigDecimal itemCostShare,
                            DuplicateAnalysis duplicates) {
    public ItemAnalysis {
        editionWarnings = editionWarnings == null ? List.of() : List.copyOf(editionWarnings);
    }
}
