package com.iozycore.core.domain.catalog;

import java.util.Set;
import java.util.UUID;

/**
 * Defines a category of Entity: its expected custom fields
 * (schema) and the valid Experience types for this type.
 * <p>
 * Dynamic type editor (V2): instances are created/changed
 * by the user via {@link com.iozycore.custom.EntityTypeService}
 * and saved in the table {@code entity_type} (already there since
 * V1, seeded with the 3 historic MVP types) - this record stays a
 * pure aggregate, with no dependency on its persistence.
 */
public record EntityType(
        UUID id,
        String code,
        String label,
        Set<String> allowedExperienceTypes,
        Set<String> customFieldKeys,
        String colorKey,
        String iconKey,
        String aspectKey
) {

    /** Historic constructor (without visual identity) - kept so that
     * callers that do not care, tests included, stay unchanged.
     * null = the client falls back to its default look. */
    public EntityType(UUID id, String code, String label, Set<String> allowedExperienceTypes,
                       Set<String> customFieldKeys) {
        this(id, code, label, allowedExperienceTypes, customFieldKeys, null, null, null);
    }

    /** Signature from before the cover format - same role as the one above. */
    public EntityType(UUID id, String code, String label, Set<String> allowedExperienceTypes,
                       Set<String> customFieldKeys, String colorKey, String iconKey) {
        this(id, code, label, allowedExperienceTypes, customFieldKeys, colorKey, iconKey, null);
    }

    public EntityType {
        if (label == null || label.isBlank()) {
            throw new IllegalArgumentException("Le label d'un EntityType ne peut pas être vide");
        }
        if (code == null || code.isBlank()) {
            throw new IllegalArgumentException("Le code d'un EntityType ne peut pas être vide");
        }
        // Normalized to UPPER_SNAKE_CASE to stay consistent with the historic
        // codes (MANGA, VIDEO_GAME, BOARD_GAME) whatever the user
        // types in the editor (e.g. "Films d'animation" -> "FILMS_D_ANIMATION").
        code = code.trim().toUpperCase().replaceAll("[^A-Z0-9]+", "_").replaceAll("^_+|_+$", "");
        allowedExperienceTypes = allowedExperienceTypes == null ? Set.of() : Set.copyOf(allowedExperienceTypes);
        customFieldKeys = customFieldKeys == null ? Set.of() : Set.copyOf(customFieldKeys);
        // colorKey/iconKey are KEYS, not render values: the backend
        // knows neither the color codes nor the icon set (the client's job,
        // see lib/entityTypeVisuals). So it only validates the shape - a
        // short slug - and lets the client fall back to its default for a key
        // that it does not know. Storing "#c05a3c" here would instead freeze
        // a color that could not adapt to the theme.
        colorKey = normalizeKey(colorKey);
        iconKey = normalizeKey(iconKey);
        aspectKey = normalizeKey(aspectKey);
    }

    private static String normalizeKey(String key) {
        if (key == null || key.isBlank()) {
            return null;
        }
        String trimmed = key.trim();
        return trimmed.matches("[a-zA-Z0-9_-]{1,32}") ? trimmed : null;
    }

    /** Creates a new type (generated id, normalized code). */
    public static EntityType create(String code, String label, Set<String> allowedExperienceTypes,
                                     Set<String> customFieldKeys) {
        return create(code, label, allowedExperienceTypes, customFieldKeys, null, null, null);
    }

    /** Variant with a chosen visual identity (see colorKey/iconKey). */
    public static EntityType create(String code, String label, Set<String> allowedExperienceTypes,
                                     Set<String> customFieldKeys, String colorKey, String iconKey, String aspectKey) {
        return new EntityType(UUID.randomUUID(), code, label, allowedExperienceTypes, customFieldKeys, colorKey,
                iconKey, aspectKey);
    }

    /** Rebuilds a type from persistence (same guarantees as {@link #create}, id kept). */
    public static EntityType reconstitute(UUID id, String code, String label, Set<String> allowedExperienceTypes,
                                           Set<String> customFieldKeys) {
        return new EntityType(id, code, label, allowedExperienceTypes, customFieldKeys, null, null);
    }

    public static EntityType reconstitute(UUID id, String code, String label, Set<String> allowedExperienceTypes,
                                           Set<String> customFieldKeys, String colorKey, String iconKey,
                                           String aspectKey) {
        return new EntityType(id, code, label, allowedExperienceTypes, customFieldKeys, colorKey, iconKey, aspectKey);
    }

    /** Returns a copy with the label/schema changed - the code never changes after creation
     * (same invariant as {@link Entity#entityTypeId()}: changing the code would lose the meaning
     * of the attributes already saved under the old code). */
    public EntityType withUpdatedFields(String newLabel, Set<String> newAllowedExperienceTypes,
                                         Set<String> newCustomFieldKeys) {
        return withUpdatedFields(newLabel, newAllowedExperienceTypes, newCustomFieldKeys, colorKey, iconKey, aspectKey);
    }

    /** Variant that also changes the visual identity - null here means "back
     * to the default look", never "unchanged": the caller sends the whole wanted
     * state (see EntityTypeController.update). {@code aspectKey}: cover format
     * (a vinyl sleeve is square, a game box is not) - same kind of key as
     * the two others. */
    public EntityType withUpdatedFields(String newLabel, Set<String> newAllowedExperienceTypes,
                                         Set<String> newCustomFieldKeys, String newColorKey, String newIconKey,
                                         String newAspectKey) {
        return new EntityType(id, code, newLabel, newAllowedExperienceTypes, newCustomFieldKeys, newColorKey,
                newIconKey, newAspectKey);
    }

    public boolean allows(String experienceType) {
        return allowedExperienceTypes.contains(experienceType);
    }
}
