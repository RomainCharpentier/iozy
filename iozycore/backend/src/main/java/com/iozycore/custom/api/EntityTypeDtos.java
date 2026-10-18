package com.iozycore.custom.api;

import com.iozycore.core.domain.catalog.EntityType;

import java.util.Set;
import java.util.UUID;

public final class EntityTypeDtos {

    private EntityTypeDtos() {
    }

    /** code is normalised on the domain side (UPPER_SNAKE_CASE) - no matter what the client sends. */
    public record CreateEntityTypeRequest(String code, String label, Set<String> allowedExperienceTypes,
                                           Set<String> customFieldKeys, String colorKey, String iconKey,
                                           String aspectKey) {
    }

    /** The code can never be changed after creation (see EntityType.withUpdatedFields). */
    public record UpdateEntityTypeRequest(String label, Set<String> allowedExperienceTypes,
                                           Set<String> customFieldKeys, String colorKey, String iconKey,
                                           String aspectKey) {
    }

    /** hasMetadataProvider: at least one MetadataProvider (Jikan/BGG/IGDB) supports this type - lets
     * clients know whether it is legitimate to require a match before confirming a quick
     * add (never the case for a custom type, which by construction has no provider). */
    /** colorKey/iconKey: visual identity chosen by the user, null = default visual
     * on the client side (see EntityType). These are KEYS, not colours:
     * the client translates them, and only it knows how to adapt to the theme. */
    /** hasDiscoverySource: a universe can suggest discoveries from what is owned
     * (DiscoverySource - same author for manga, similar games for video games, trending games with the
     * same mechanics for board games). The type tells the client this, never a list
     * of codes written in the screen (batch 142): a custom type has none. */
    /** hasReleaseSource: a universe can date the releases of this type without them being entered (ReleaseSource -
     * Google Books for the volumes of a manga, IGDB for a video game, batch 146). A type that nobody covers
     * has on the calendar only the dates entered on its work pages, and the type tells the client this. */
    public record EntityTypeResponse(UUID id, String code, String label, Set<String> allowedExperienceTypes,
                                      Set<String> customFieldKeys, boolean hasMetadataProvider,
                                      boolean hasDiscoverySource, boolean hasReleaseSource,
                                      String colorKey, String iconKey, String aspectKey) {
        public static EntityTypeResponse from(EntityType t, boolean hasMetadataProvider, boolean hasDiscoverySource,
                                              boolean hasReleaseSource) {
            return new EntityTypeResponse(t.id(), t.code(), t.label(), t.allowedExperienceTypes(),
                    t.customFieldKeys(), hasMetadataProvider, hasDiscoverySource, hasReleaseSource, t.colorKey(),
                    t.iconKey(), t.aspectKey());
        }
    }
}
