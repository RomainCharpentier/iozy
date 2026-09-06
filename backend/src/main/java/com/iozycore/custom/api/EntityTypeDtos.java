package com.iozycore.custom.api;

import com.iozycore.core.domain.catalog.EntityType;

import java.util.Set;
import java.util.UUID;

public final class EntityTypeDtos {

    private EntityTypeDtos() {
    }

    /** code est normalisé côté domaine (UPPER_SNAKE_CASE) - peu importe ce que le client envoie. */
    public record CreateEntityTypeRequest(String code, String label, Set<String> allowedExperienceTypes,
                                           Set<String> customFieldKeys, String colorKey, String iconKey,
                                           String aspectKey) {
    }

    /** Le code n'est jamais modifiable après création (voir EntityType.withUpdatedFields). */
    public record UpdateEntityTypeRequest(String label, Set<String> allowedExperienceTypes,
                                           Set<String> customFieldKeys, String colorKey, String iconKey,
                                           String aspectKey) {
    }

    /** hasMetadataProvider : au moins un MetadataProvider (Jikan/BGG/IGDB) supporte ce type - permet
     * aux clients de savoir s'il est légitime d'exiger une correspondance avant de valider un ajout
     * rapide (jamais le cas pour un type personnalisé, qui n'a par construction aucun fournisseur). */
    /** colorKey/iconKey : identité visuelle choisie par l'utilisateur, null = visuel
     * par défaut côté client (voir EntityType). Ce sont des CLÉS, pas des couleurs :
     * c'est le client qui les traduit, et lui seul sait s'adapter au thème. */
    /** hasDiscoverySource : un univers sait proposer des decouvertes a partir de ce qu'on possede
     * (DiscoverySource - meme auteur pour le manga, jeux proches pour le jeu video, jeux en vue aux
     * memes mecaniques pour le jeu de societe). C'est le type qui le dit au client, jamais une liste
     * de codes ecrite dans l'ecran (lot 142) : un type personnalise n'en a aucune. */
    public record EntityTypeResponse(UUID id, String code, String label, Set<String> allowedExperienceTypes,
                                      Set<String> customFieldKeys, boolean hasMetadataProvider,
                                      boolean hasDiscoverySource,
                                      String colorKey, String iconKey, String aspectKey) {
        public static EntityTypeResponse from(EntityType t, boolean hasMetadataProvider, boolean hasDiscoverySource) {
            return new EntityTypeResponse(t.id(), t.code(), t.label(), t.allowedExperienceTypes(),
                    t.customFieldKeys(), hasMetadataProvider, hasDiscoverySource, t.colorKey(), t.iconKey(),
                    t.aspectKey());
        }
    }
}
