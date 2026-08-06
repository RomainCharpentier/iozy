package com.iozycore.api.dto;

import com.iozycore.domain.catalog.Entity;
import com.iozycore.domain.ownership.OwnershipCondition;

import java.util.Map;
import java.util.Set;
import java.util.UUID;

public final class EntityDtos {

    private EntityDtos() {
    }

    /** Corps de requête de l'ajout rapide (UC1 / parcours 1). attributes est
     * optionnel - typiquement rempli avec les attributs d'un MetadataCandidate
     * choisi après une recherche via GET /api/metadata/search. */
    public record QuickAddRequest(UUID entityTypeId, String title, OwnershipCondition condition,
                                   Map<String, Object> attributes) {
        public Map<String, Object> attributesOrEmpty() {
            return attributes == null ? Map.of() : attributes;
        }
    }

    public record EntityResponse(UUID id, UUID entityTypeId, String title, Map<String, Object> attributes,
                                  Set<UUID> tagIds) {
        public static EntityResponse from(Entity entity) {
            return new EntityResponse(
                    entity.id(), entity.entityTypeId(), entity.title(), entity.attributes(), entity.tagIds());
        }
    }

    /** Réponse de l'ajout rapide - matchedExistingEntity indique qu'un doublon a été évité (UC1, étape 6). */
    public record QuickAddResponse(UUID entityId, boolean matchedExistingEntity) {
    }
}
