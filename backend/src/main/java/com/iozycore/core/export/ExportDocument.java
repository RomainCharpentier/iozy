package com.iozycore.core.export;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * "Full data export (JSON/CSV)" (§19, docs/CONCEPTION.md) -
 * guarantees no lock-in even when self-hosted: the whole collection
 * in a single self-sufficient structure, readable without having to
 * query the database to cross-check ids. Titles/labels are
 * deliberately denormalized next to the IDs (e.g. entityTitle on an
 * OwnershipExport) - a bit redundant, but an "anti lock-in" export
 * must stay readable and usable alone, including when opened in a spreadsheet
 * or by someone other than the author of the schema.
 */
public record ExportDocument(
        String generatedAt,
        List<EntityExport> entities,
        List<OwnershipExport> ownerships,
        List<ExperienceExport> experiences,
        List<WishlistEntryExport> wishlist,
        List<RelationshipExport> relationships,
        List<TagExport> tags,
        // Added in Batch 33: typed by hand, unrecoverable, and yet
        // missing from an export that promises "no lock-in" - without the
        // reference editions, no "X of Y" can be rebuilt anymore.
        List<MangaEditionExport> editions,
        List<GeneralRankExport> generalRankings,
        List<TierListExport> tierLists,
        // Added in Batch 79, same criterion as in Batch 33: typed by hand,
        // unrecoverable elsewhere, and yet missing from an export that promises
        // no lock-in.
        List<MarketObservationExport> marketObservations,
        List<FollowedEditionExport> followedEditions,
        // Added on 2026-09-11 with the Followed state: typed by hand, like a wish.
        List<FollowedWorkExport> followedWorks,
        List<EntityTypeExport> entityTypes,
        CollectorPreferencesExport collectorPreferences
) {
    /**
     * {@code mangaEditionId} is the volume -> reference edition link. Added
     * in Batch 115: without it, a re-imported export lost this link, and
     * each "X of Y" started again from zero.
     */
    public record VariantExport(UUID id, String label, Map<String, Object> attributes, UUID mangaEditionId) {
    }

    /** champsSaisis: the attribute keys typed by hand (Batch 130) - an import takes them back,
     *  so that a reload from the source does not overwrite them either on the other instance.
     *  Missing from an older export: read as empty. */
    public record EntityExport(UUID id, String entityTypeCode, String entityTypeLabel, String title,
                                Map<String, Object> attributes, List<String> tagLabels,
                                List<VariantExport> variants, List<String> champsSaisis) {
    }

    public record OwnershipExport(UUID id, UUID entityId, String entityTitle, UUID variantId, String variantLabel,
                                   String condition, String status, LocalDate acquiredAt, String note,
                                   BigDecimal purchasePrice) {
    }

    public record ExperienceExport(UUID id, UUID entityId, String entityTitle, UUID variantId, String variantLabel,
                                    String experienceType, LocalDate occurredAt, Integer rating, String comment) {
    }

    /** {@code variantId}: a wish is about a VOLUME for a manga (see WishlistEntry.addVariant) - Batch 115. */
    public record WishlistEntryExport(UUID id, UUID entityId, String entityTitle, UUID variantId, String variantLabel,
                                       LocalDate addedAt) {
    }

    public record RelationshipExport(UUID id, UUID sourceEntityId, String sourceEntityTitle, UUID targetEntityId,
                                      String targetEntityTitle, String relationshipType) {
    }

    public record MangaEditionExport(UUID id, UUID entityId, String seriesTitle, String editionName, String tier,
                                      String publisher, Integer totalVolumes, BigDecimal retailPriceNewPerVolume,
                                      boolean outOfPrint, boolean betterEditionAnnounced, String betterEditionNote,
                                      String languageCode) {
    }

    /** General ranking of a work (S-F scale), outside a named Tier List. */
    public record FollowedWorkExport(UUID entityId, String entityTitle, LocalDate followedAt) {
    }

    public record GeneralRankExport(UUID entityId, String entityTitle, String rank) {
    }

    public record TierListExport(UUID id, String name, String entityTypeLabel, String description,
                                  List<String> activeRanks, List<TierListItemExport> items) {
    }

    public record TierListItemExport(UUID entityId, String entityTitle, String rank) {
    }

    public record TagExport(UUID id, String label) {
    }

    /**
     * A recorded price. {@code origin} tells apart what the user typed
     * themselves (MANUAL_ENTRY) from what the analysis of a listing kept
     * (LISTING_ANALYSIS) - both count as market data, and the
     * first exists nowhere else.
     */
    public record MarketObservationExport(UUID id, UUID mangaEditionId, String seriesTitle, String editionName,
                                           Integer volumeRangeStart, Integer volumeRangeEnd, Integer volumeCount,
                                           BigDecimal observedPrice, String platform, String observedCondition,
                                           LocalDate observedAt, String origin, String sourceUrl, String note) {
    }

    /** The edition that is really collected, per series - a choice, not a page. */
    public record FollowedEditionExport(UUID id, UUID entityId, String entityTitle, String editionName,
                                         LocalDate followedAt) {
    }

    /**
     * The collection types, color/icon/format included: a custom
     * type created from Administration cannot be rebuilt from
     * the code and label carried by the works.
     */
    public record EntityTypeExport(UUID id, String code, String label, List<String> allowedExperienceTypes,
                                    List<String> customFieldKeys, String colorKey, String iconKey, String aspectKey) {
    }

    /** The profile that weights the verdict of a purchase analysis. */
    public record CollectorPreferencesExport(List<String> editionTierRanking,
                                              boolean avoidOutdatedEditionWhenBetterExistsOrAnnounced,
                                              String conditionImportance, int minimumDiscountVsRetailPercent,
                                              Map<String, Integer> factorWeights) {
    }

    /**
     * What a universe adds to the document (Batch 133): the core neither reads
     * nor writes these sections, it assembles them. The format, though, stays here -
     * it is a shared contract, not a code dependency.
     */
    public record SectionsUnivers(List<MangaEditionExport> editions,
                                  List<MarketObservationExport> marketObservations,
                                  List<FollowedEditionExport> followedEditions,
                                  CollectorPreferencesExport collectorPreferences) {

        public static SectionsUnivers vides() {
            return new SectionsUnivers(List.of(), List.of(), List.of(), null);
        }

        /** The sections of both, end to end; the preferences of the other if it has some. */
        public SectionsUnivers avec(SectionsUnivers autre) {
            if (autre == null) {
                return this;
            }
            List<MangaEditionExport> e = new java.util.ArrayList<>(editions);
            e.addAll(autre.editions() == null ? List.of() : autre.editions());
            List<MarketObservationExport> m = new java.util.ArrayList<>(marketObservations);
            m.addAll(autre.marketObservations() == null ? List.of() : autre.marketObservations());
            List<FollowedEditionExport> f = new java.util.ArrayList<>(followedEditions);
            f.addAll(autre.followedEditions() == null ? List.of() : autre.followedEditions());
            return new SectionsUnivers(e, m, f, autre.collectorPreferences() != null ? autre.collectorPreferences() : collectorPreferences);
        }
    }
}
