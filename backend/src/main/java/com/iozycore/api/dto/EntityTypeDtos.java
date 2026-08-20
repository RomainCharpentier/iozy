package com.iozycore.api.dto;

import com.iozycore.domain.catalog.EntityType;

import java.util.Set;
import java.util.UUID;

public final class EntityTypeDtos {

    private EntityTypeDtos() {
    }

    /** code est normalisé côté domaine (UPPER_SNAKE_CASE) - peu importe ce que le client envoie. */
    public record CreateEntityTypeRequest(String code, String label, Set<String> allowedExperienceTypes,
                                           Set<String> customFieldKeys, String colorKey, String iconKey) {
    }

    /** Le code n'est jamais modifiable après création (voir EntityType.withUpdatedFields). */
    public record UpdateEntityTypeRequest(String label, Set<String> allowedExperienceTypes,
                                           Set<String> customFieldKeys, String colorKey, String iconKey) {
    }

    /** hasMetadataProvider : au moins un MetadataProvider (Jikan/BGG/IGDB) supporte ce type - permet
     * aux clients de savoir s'il est légitime d'exiger une correspondance avant de valider un ajout
     * rapide (jamais le cas pour un type personnalisé, qui n'a par construction aucun fournisseur). */
    /** colorKey/iconKey : identité visuelle choisie par l'utilisateur, null = visuel
     * par défaut côté client (voir EntityType). Ce sont des CLÉS, pas des couleurs :
     * c'est le client qui les traduit, et lui seul sait s'adapter au thème. */
    public record EntityTypeResponse(UUID id, String code, String label, Set<String> allowedExperienceTypes,
                                      Set<String> customFieldKeys, boolean hasMetadataProvider,
                                      String colorKey, String iconKey) {
        public static EntityTypeResponse from(EntityType t, boolean hasMetadataProvider) {
            return new EntityTypeResponse(t.id(), t.code(), t.label(), t.allowedExperienceTypes(),
                    t.customFieldKeys(), hasMetadataProvider, t.colorKey(), t.iconKey());
        }
    }
}
