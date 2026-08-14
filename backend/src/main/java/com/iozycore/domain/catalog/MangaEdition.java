package com.iozycore.domain.catalog;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/**
 * Reference data for one French edition of one series (e.g. "Death Note" /
 * "Black Edition") - populated progressively by the user the first time an
 * analysis or an addition references an edition unknown to the system, then
 * reused everywhere else that same edition is referenced.
 * <p>
 * {@code totalVolumes} is {@code null} when genuinely unknown - never
 * defaulted to 0, which would wrongly read as "this edition has no
 * volumes" instead of "completeness cannot be computed yet".
 * <p>
 * Moved into the catalog domain (2026-08-14, modèle manga cible Série ->
 * Édition -> Tome) from the {@code purchaseanalysis} module it was
 * originally built in for "Analyse d'achat": every field here (name, tier,
 * publisher, volume count, language, out-of-print, better-edition-announced,
 * retail price) is an intrinsic catalog fact about the edition itself, none
 * of them specific to evaluating a purchase - the data genuinely specific
 * to that use case (verdict, negotiation) lives separately in
 * {@code PurchaseAnalysis}/{@code NegotiationRecommendation}, which
 * reference this class by import rather than own it. Table name
 * ({@code manga_edition}) kept unchanged to avoid an unnecessary rename
 * migration.
 * <p>
 * {@code entityId} links this edition to its Série ({@link Entity}) -
 * nullable and additive. {@code seriesTitle} remains the primary
 * identifier used by text-matching (see {@code SeriesMatcher}) during
 * import/purchase-analysis: an edition can legitimately exist before, or
 * without ever having, a matched catalog Entity (e.g. evaluating a listing
 * for a series not yet in the collection). {@code entityId} is populated
 * once/if a real Entity is matched, never invented - see
 * {@link #withEntityId(UUID)}.
 */
public record MangaEdition(UUID id, UUID entityId, String seriesTitle, String editionName, EditionTier tier,
                            String publisher, Integer totalVolumes, BigDecimal retailPriceNewPerVolume,
                            boolean outOfPrint, boolean betterEditionAnnounced, String betterEditionNote,
                            String languageCode, Instant createdAt, Instant updatedAt) {

    public MangaEdition {
        if (seriesTitle == null || seriesTitle.isBlank()) {
            throw new IllegalArgumentException("A manga edition must reference a series title");
        }
        if (editionName == null || editionName.isBlank()) {
            throw new IllegalArgumentException("A manga edition must have a name");
        }
        if (totalVolumes != null && totalVolumes < 1) {
            throw new IllegalArgumentException("totalVolumes must be at least 1 when known");
        }
        if (retailPriceNewPerVolume != null && retailPriceNewPerVolume.signum() < 0) {
            throw new IllegalArgumentException("retailPriceNewPerVolume cannot be negative");
        }
        languageCode = languageCode == null || languageCode.isBlank() ? "fr" : languageCode;
    }

    /** Without a known Série yet - see {@code entityId} javadoc above. */
    public static MangaEdition create(String seriesTitle, String editionName, EditionTier tier, String publisher,
                                       Integer totalVolumes, BigDecimal retailPriceNewPerVolume, boolean outOfPrint,
                                       boolean betterEditionAnnounced, String betterEditionNote) {
        return create(null, seriesTitle, editionName, tier, publisher, totalVolumes, retailPriceNewPerVolume,
                outOfPrint, betterEditionAnnounced, betterEditionNote);
    }

    /** Variant that also links this edition to its catalog Série from creation. */
    public static MangaEdition create(UUID entityId, String seriesTitle, String editionName, EditionTier tier,
                                       String publisher, Integer totalVolumes, BigDecimal retailPriceNewPerVolume,
                                       boolean outOfPrint, boolean betterEditionAnnounced, String betterEditionNote) {
        Instant now = Instant.now();
        return new MangaEdition(UUID.randomUUID(), entityId, seriesTitle, editionName, tier, publisher, totalVolumes,
                retailPriceNewPerVolume, outOfPrint, betterEditionAnnounced, betterEditionNote, "fr", now, now);
    }

    /** Partial update (progressive enrichment) - any {@code null} argument keeps the current value. */
    public MangaEdition withUpdatedReferenceData(EditionTier tier, String publisher, Integer totalVolumes,
                                                  BigDecimal retailPriceNewPerVolume, Boolean outOfPrint,
                                                  Boolean betterEditionAnnounced, String betterEditionNote) {
        return new MangaEdition(id, entityId, seriesTitle, editionName,
                tier != null ? tier : this.tier,
                publisher != null ? publisher : this.publisher,
                totalVolumes != null ? totalVolumes : this.totalVolumes,
                retailPriceNewPerVolume != null ? retailPriceNewPerVolume : this.retailPriceNewPerVolume,
                outOfPrint != null ? outOfPrint : this.outOfPrint,
                betterEditionAnnounced != null ? betterEditionAnnounced : this.betterEditionAnnounced,
                betterEditionNote != null ? betterEditionNote : this.betterEditionNote,
                languageCode, createdAt, Instant.now());
    }

    /** Links this edition to its catalog Série after the fact (e.g. once SeriesMatcher resolves a real Entity for
     * an edition that was created before one existed) - additive, never called with null to erase a known value. */
    public MangaEdition withEntityId(UUID entityId) {
        return new MangaEdition(id, entityId, seriesTitle, editionName, tier, publisher, totalVolumes,
                retailPriceNewPerVolume, outOfPrint, betterEditionAnnounced, betterEditionNote, languageCode,
                createdAt, Instant.now());
    }
}
