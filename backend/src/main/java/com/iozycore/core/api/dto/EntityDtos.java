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

    /** Corps de requête de l'ajout rapide (UC1 / parcours 1). attributes est
     * optionnel - typiquement rempli avec les attributs d'un MetadataCandidate
     * choisi après une recherche via GET /api/metadata/search. volumeNumber,
     * edition et volumeImageUrl sont optionnels et tous réservés au cas "tome
     * d'une série" (Manga) : voir QuickAddService pour la distinction série
     * (Entity) / tome précis d'une édition (Variant). volumeImageUrl est la
     * jaquette de CE tome précis (voir VolumeCandidate), distincte de la
     * jaquette de la série éventuellement présente dans attributes.
     * purchasePrice est optionnel (voir Ownership.updatePurchasePrice) - jamais
     * deviné, reste modifiable après coup via PATCH /api/ownerships/{id}/purchase-price. */
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

    /** champsSaisis : les cles d'attributes saisies a la main, qu'un rechargement
     *  depuis la source ne touche pas (Lot 130) - l'ecran les signale. */
    public record EntityResponse(UUID id, UUID entityTypeId, String title, Map<String, Object> attributes,
                                  Set<UUID> tagIds, List<VariantResponse> variants, Set<String> champsSaisis) {
        public static EntityResponse from(Entity entity) {
            return new EntityResponse(
                    entity.id(), entity.entityTypeId(), entity.title(), entity.attributes(), entity.tagIds(),
                    entity.variants().stream().map(VariantResponse::from).toList(), entity.champsSaisis());
        }
    }

    /** Réponse de l'ajout rapide - matchedExistingEntity indique qu'un doublon
     * a été évité en réutilisant une Entity existante (UC1, étape 6). variantId
     * est null si aucun tome n'a été précisé ; matchedExistingVariant indique
     * qu'une Ownership active référence déjà ce même tome (utile pour avertir
     * l'utilisateur qu'il possède peut-être déjà cette édition de ce tome). */
    public record QuickAddResponse(UUID entityId, boolean matchedExistingEntity,
                                    UUID variantId, boolean matchedExistingVariant) {
    }
}
