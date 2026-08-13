package com.iozycore.export;

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
        List<TagExport> tags
) {
    public record VariantExport(UUID id, String label, Map<String, Object> attributes) {
    }

    public record EntityExport(UUID id, String entityTypeCode, String entityTypeLabel, String title,
                                Map<String, Object> attributes, List<String> tagLabels,
                                List<VariantExport> variants) {
    }

    public record OwnershipExport(UUID id, UUID entityId, String entityTitle, UUID variantId, String variantLabel,
                                   String condition, String status, LocalDate acquiredAt, String note,
                                   BigDecimal purchasePrice) {
    }

    public record ExperienceExport(UUID id, UUID entityId, String entityTitle, UUID variantId, String variantLabel,
                                    String experienceType, LocalDate occurredAt, Integer rating, String comment) {
    }

    public record WishlistEntryExport(UUID id, UUID entityId, String entityTitle, LocalDate addedAt) {
    }

    public record RelationshipExport(UUID id, UUID sourceEntityId, String sourceEntityTitle, UUID targetEntityId,
                                      String targetEntityTitle, String relationshipType) {
    }

    public record TagExport(UUID id, String label) {
    }
}
