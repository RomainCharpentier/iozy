package com.iozycore.core.api.dto;

import com.iozycore.core.domain.catalog.Entity;
import com.iozycore.core.domain.catalog.Variant;
import com.iozycore.core.domain.ownership.OwnershipCondition;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

public final class EntityDtos {

    private EntityDtos() {
    }

    /** Request body of the quick add (UC1 / path 1). attributes is
     * optional - typically filled with the attributes of a MetadataCandidate
     * chosen after a search through GET /api/metadata/search. volumeNumber,
     * edition and volumeImageUrl are optional and all reserved for the "volume
     * of a series" case (Manga): see QuickAddService for the series
     * (Entity) / specific volume of an edition (Variant) distinction. volumeImageUrl is the
     * cover of THIS specific volume (see VolumeCandidate), different from the
     * cover of the series possibly present in attributes.
     * purchasePrice is optional (see Ownership.updatePurchasePrice) - never
     * guessed, stays editable afterwards via PATCH /api/ownerships/{id}/purchase-price. */
    public record QuickAddRequest(UUID entityTypeId, String title, OwnershipCondition condition,
                                   Map<String, Object> attributes, Integer volumeNumber, String edition,
                                   String volumeImageUrl, BigDecimal purchasePrice, LocalDate acquiredAt) {
        public Map<String, Object> attributesOrEmpty() {
            return attributes == null ? Map.of() : attributes;
        }
    }

    public record VariantResponse(UUID id, String label, Map<String, Object> attributes, UUID mangaEditionId) {
        public static VariantResponse from(Variant variant) {
            return new VariantResponse(variant.id(), variant.label(), variant.attributes(), variant.mangaEditionId());
        }
    }

    /** champsSaisis: the attribute keys typed by hand, which a reload
     *  from the source does not touch (Batch 130) - the screen flags them. */
    public record EntityResponse(UUID id, UUID entityTypeId, String title, Map<String, Object> attributes,
                                  Set<UUID> tagIds, List<VariantResponse> variants, Set<String> champsSaisis) {
        public static EntityResponse from(Entity entity) {
            return new EntityResponse(
                    entity.id(), entity.entityTypeId(), entity.title(), entity.attributes(), entity.tagIds(),
                    entity.variants().stream().map(VariantResponse::from).toList(), entity.champsSaisis());
        }
    }

    /** Response of the quick add - matchedExistingEntity says that a duplicate
     * was avoided by reusing an existing Entity (UC1, step 6). variantId
     * is null if no volume was specified; matchedExistingVariant says
     * that an active Ownership already references this same volume (useful to warn
     * the user that they may already own this edition of this volume). */
    public record QuickAddResponse(UUID entityId, boolean matchedExistingEntity,
                                    UUID variantId, boolean matchedExistingVariant) {
    }
}
