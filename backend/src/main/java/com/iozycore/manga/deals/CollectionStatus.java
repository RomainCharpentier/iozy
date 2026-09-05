package com.iozycore.manga.deals;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.iozycore.manga.domain.MangaEdition;

import java.math.BigDecimal;
import java.util.List;

/**
 * Completeness of one listing item against its {@link MangaEdition} -
 * ALWAYS computed per edition, never at the series/work level, since two
 * editions of the same series can have different volume counts.
 *
 * @param totalVolumes               null when the edition's total volume count is unknown - completeness
 *                                   cannot be computed in that case, see {@link #missingCount()}
 * @param missingCount               null when {@code totalVolumes} is unknown; 0 means the listing
 *                                   completes the edition entirely
 * @param cataloguedMissingVolumeNumbers étape 6/8 (modèle Tome != Ownership) - parmi
 *                                   {@code missingVolumeNumbers}, ceux qui ont déjà un Variant catalogué
 *                                   (juste sans Ownership active) plutôt que purement virtuels (aucun
 *                                   Variant, seulement un numéro déduit de {@code totalVolumes}). Toujours
 *                                   vide pour un appelant qui ne fournit pas cette distinction (voir
 *                                   {@link CompletenessCalculator#compute(java.util.Set, MangaEdition, MarketPrice)}).
 * @param estimatedCostToComplete    null when it cannot be computed (unknown total, or no price data at all) -
 *                                   {@link BigDecimal#ZERO} when the listing already completes the edition,
 *                                   regardless of whether any price data exists (nothing left to price)
 * @param costToCompleteBasis        null when {@code estimatedCostToComplete} is null, or when it is zero
 *                                   because the edition is already complete (no price was actually used)
 */
public record CollectionStatus(MangaEdition edition, Integer totalVolumes, Integer missingCount,
                                List<Integer> missingVolumeNumbers, List<Integer> cataloguedMissingVolumeNumbers,
                                BigDecimal estimatedCostToComplete, PriceBasis costToCompleteBasis) {
    public CollectionStatus {
        missingVolumeNumbers = missingVolumeNumbers == null ? List.of() : List.copyOf(missingVolumeNumbers);
        cataloguedMissingVolumeNumbers = cataloguedMissingVolumeNumbers == null ? List.of() : List.copyOf(cataloguedMissingVolumeNumbers);
    }

    // @JsonIgnore on both: these are derived helpers, not real fields - without
    // it, Jackson's bean-getter auto-detection (isXxx() naming) serializes them
    // as extra JSON properties ("known"/"complete") that don't match any
    // canonical record component, which then breaks deserialization of the
    // JSONB payload with an UnrecognizedPropertyException (see
    // PurchaseAnalysisJpaEntity - caught by
    // PurchaseAnalysisPersistenceIntegrationTest after forcing a real cache
    // miss with entityManager.clear()).
    @JsonIgnore
    public boolean isComplete() {
        return missingCount != null && missingCount == 0;
    }

    @JsonIgnore
    public boolean isKnown() {
        return totalVolumes != null;
    }
}
