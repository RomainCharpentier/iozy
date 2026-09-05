package com.iozycore.core.export;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * "Export complet des données (JSON/CSV)" (§19, docs/CONCEPTION.md) -
 * garantit l'absence d'enfermement même auto-hébergé : toute la collection
 * en une seule structure auto-suffisante, lisible sans avoir besoin de
 * requêter la base pour recroiser les identifiants. Les titres/labels sont
 * délibérément dénormalisés à côté des IDs (ex: entityTitle sur une
 * OwnershipExport) - un peu redondant, mais un export "anti-enfermement"
 * doit rester lisible et exploitable seul, y compris ouvert dans un tableur
 * ou par quelqu'un d'autre que l'auteur du schéma.
 */
public record ExportDocument(
        String generatedAt,
        List<EntityExport> entities,
        List<OwnershipExport> ownerships,
        List<ExperienceExport> experiences,
        List<WishlistEntryExport> wishlist,
        List<RelationshipExport> relationships,
        List<TagExport> tags,
        // Ajoutées au Lot 33 : saisies à la main, irrécupérables, et pourtant
        // absentes d'un export qui promet "l'absence d'enfermement" - sans les
        // éditions de référence, plus aucun "X sur Y" ne peut être reconstruit.
        List<MangaEditionExport> editions,
        List<GeneralRankExport> generalRankings,
        List<TierListExport> tierLists,
        // Ajoutees au Lot 79, meme critere qu'au Lot 33 : saisi a la main,
        // irrecuperable ailleurs, et pourtant absent d'un export qui promet
        // l'absence d'enfermement.
        List<MarketObservationExport> marketObservations,
        List<FollowedEditionExport> followedEditions,
        List<EntityTypeExport> entityTypes,
        CollectorPreferencesExport collectorPreferences
) {
    /**
     * {@code mangaEditionId} est le lien tome -> edition de reference. Ajoute
     * au Lot 115 : sans lui, un export reimporte perdait ce rattachement, et
     * chaque "X sur Y" repartait de zero.
     */
    public record VariantExport(UUID id, String label, Map<String, Object> attributes, UUID mangaEditionId) {
    }

    /** champsSaisis : les cles d'attributes saisies a la main (Lot 130) - un import les reprend,
     *  pour qu'un rechargement depuis la source ne les ecrase pas non plus sur l'autre instance.
     *  Absent d'un export anterieur : lu comme vide. */
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

    /** {@code variantId} : une envie porte sur un TOME pour un manga (voir WishlistEntry.addVariant) - Lot 115. */
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

    /** Classement général d'une œuvre (échelle S-F), hors Tier List nommée. */
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
     * Un prix releve. {@code origin} distingue ce que l'utilisateur a saisi
     * lui-meme (MANUAL_ENTRY) de ce que l'analyse d'une annonce a retenu
     * (LISTING_ANALYSIS) - les deux comptent comme donnees de marche, et le
     * premier n'existe nulle part ailleurs.
     */
    public record MarketObservationExport(UUID id, UUID mangaEditionId, String seriesTitle, String editionName,
                                           Integer volumeRangeStart, Integer volumeRangeEnd, Integer volumeCount,
                                           BigDecimal observedPrice, String platform, String observedCondition,
                                           LocalDate observedAt, String origin, String sourceUrl, String note) {
    }

    /** L'edition qu'on collectionne reellement, par serie - un choix, pas une fiche. */
    public record FollowedEditionExport(UUID id, UUID entityId, String entityTitle, String editionName,
                                         LocalDate followedAt) {
    }

    /**
     * Les types de collection, couleur/icone/format compris : un type
     * personnalise cree depuis Administration ne se reconstruit pas a partir
     * du code et du libelle portes par les oeuvres.
     */
    public record EntityTypeExport(UUID id, String code, String label, List<String> allowedExperienceTypes,
                                    List<String> customFieldKeys, String colorKey, String iconKey, String aspectKey) {
    }

    /** Le profil qui pondere le verdict d'une analyse d'achat. */
    public record CollectorPreferencesExport(List<String> editionTierRanking,
                                              boolean avoidOutdatedEditionWhenBetterExistsOrAnnounced,
                                              String conditionImportance, int minimumDiscountVsRetailPercent,
                                              Map<String, Integer> factorWeights) {
    }

    /**
     * Ce qu'un univers ajoute au document (Lot 133) : le cœur ne lit ni
     * n'écrit ces sections, il les assemble. Le format, lui, reste ici -
     * c'est un contrat partagé, pas une dépendance de code.
     */
    public record SectionsUnivers(List<MangaEditionExport> editions,
                                  List<MarketObservationExport> marketObservations,
                                  List<FollowedEditionExport> followedEditions,
                                  CollectorPreferencesExport collectorPreferences) {

        public static SectionsUnivers vides() {
            return new SectionsUnivers(List.of(), List.of(), List.of(), null);
        }

        /** Les sections des deux, bout à bout ; les préférences de l'autre si elle en a. */
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
