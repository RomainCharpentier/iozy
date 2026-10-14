package com.iozycore.core.application;

import com.iozycore.core.domain.catalog.EntityType;
import com.iozycore.core.domain.catalog.EntityTypeRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.UUID;

/**
 * The collection type named by a request. An unknown type is a bad request
 * (400), not a missing page: the route exists, the body or the query names a
 * type that does not.
 */
@Service
@RequiredArgsConstructor
public class EntityTypeLookup {

    private final EntityTypeRepository entityTypeRepository;

    public EntityType require(UUID entityTypeId) {
        if (entityTypeId == null) {
            throw new IllegalArgumentException(
                    "Requête invalide : un identifiant obligatoire est absent ou mal formé.");
        }
        return entityTypeRepository.findById(entityTypeId)
                .orElseThrow(() -> new IllegalArgumentException("EntityType inconnu : " + entityTypeId));
    }
}
