package com.iozycore.domain.catalog;

import java.util.Set;
import java.util.UUID;

/**
 * Définit une catégorie d'Entity : ses champs personnalisés attendus
 * (schema) et les types d'Experience valides pour ce type.
 * <p>
 * Éditeur de types dynamique (V2) : les instances sont créées/modifiées
 * par l'utilisateur via {@link com.iozycore.application.EntityTypeService}
 * et persistées dans la table {@code entity_type} (déjà présente depuis
 * V1, seedée avec les 3 types MVP historiques) - ce record reste un
 * agrégat pur, sans dépendance à sa persistance.
 */
public record EntityType(
        UUID id,
        String code,
        String label,
        Set<String> allowedExperienceTypes,
        Set<String> customFieldKeys,
        String colorKey,
        String iconKey
) {

    /** Constructeur historique (sans identité visuelle) - conservé pour que les
     * appelants qui n'en ont rien à faire, tests compris, restent inchangés.
     * null = le client retombe sur son visuel par défaut. */
    public EntityType(UUID id, String code, String label, Set<String> allowedExperienceTypes,
                       Set<String> customFieldKeys) {
        this(id, code, label, allowedExperienceTypes, customFieldKeys, null, null);
    }

    public EntityType {
        if (label == null || label.isBlank()) {
            throw new IllegalArgumentException("Le label d'un EntityType ne peut pas être vide");
        }
        if (code == null || code.isBlank()) {
            throw new IllegalArgumentException("Le code d'un EntityType ne peut pas être vide");
        }
        // Normalisé en UPPER_SNAKE_CASE pour rester cohérent avec les codes
        // historiques (MANGA, VIDEO_GAME, BOARD_GAME) quel que soit ce que
        // l'utilisateur saisit dans l'éditeur (ex: "Films d'animation" -> "FILMS_D_ANIMATION").
        code = code.trim().toUpperCase().replaceAll("[^A-Z0-9]+", "_").replaceAll("^_+|_+$", "");
        allowedExperienceTypes = allowedExperienceTypes == null ? Set.of() : Set.copyOf(allowedExperienceTypes);
        customFieldKeys = customFieldKeys == null ? Set.of() : Set.copyOf(customFieldKeys);
        // colorKey/iconKey sont des CLÉS, pas des valeurs de rendu : le backend
        // ne connaît ni les codes couleur ni le jeu d'icônes (affaire du client,
        // voir lib/entityTypeVisuals). Il ne valide donc que la forme - un
        // slug court - et laisse le client retomber sur son défaut pour une clé
        // qu'il ne connaîtrait pas. Stocker "#c05a3c" ici figerait au contraire
        // une couleur qui ne saurait pas s'adapter au thème.
        colorKey = normalizeKey(colorKey);
        iconKey = normalizeKey(iconKey);
    }

    private static String normalizeKey(String key) {
        if (key == null || key.isBlank()) {
            return null;
        }
        String trimmed = key.trim();
        return trimmed.matches("[a-zA-Z0-9_-]{1,32}") ? trimmed : null;
    }

    /** Crée un nouveau type (id généré, code normalisé). */
    public static EntityType create(String code, String label, Set<String> allowedExperienceTypes,
                                     Set<String> customFieldKeys) {
        return create(code, label, allowedExperienceTypes, customFieldKeys, null, null);
    }

    /** Variante avec identité visuelle choisie (voir colorKey/iconKey). */
    public static EntityType create(String code, String label, Set<String> allowedExperienceTypes,
                                     Set<String> customFieldKeys, String colorKey, String iconKey) {
        return new EntityType(UUID.randomUUID(), code, label, allowedExperienceTypes, customFieldKeys, colorKey, iconKey);
    }

    /** Reconstruit un type depuis la persistance (mêmes garanties que {@link #create}, id conservé). */
    public static EntityType reconstitute(UUID id, String code, String label, Set<String> allowedExperienceTypes,
                                           Set<String> customFieldKeys) {
        return new EntityType(id, code, label, allowedExperienceTypes, customFieldKeys, null, null);
    }

    public static EntityType reconstitute(UUID id, String code, String label, Set<String> allowedExperienceTypes,
                                           Set<String> customFieldKeys, String colorKey, String iconKey) {
        return new EntityType(id, code, label, allowedExperienceTypes, customFieldKeys, colorKey, iconKey);
    }

    /** Retourne une copie avec le label/schema modifiés - le code ne change jamais après création
     * (même invariant que {@link Entity#entityTypeId()} : changer de code ferait perdre le sens
     * des attributs déjà enregistrés sous l'ancien code). */
    public EntityType withUpdatedFields(String newLabel, Set<String> newAllowedExperienceTypes,
                                         Set<String> newCustomFieldKeys) {
        return withUpdatedFields(newLabel, newAllowedExperienceTypes, newCustomFieldKeys, colorKey, iconKey);
    }

    /** Variante qui touche aussi l'identité visuelle - null y signifie "retour
     * au visuel par défaut", jamais "inchangé" : l'appelant envoie l'état voulu
     * en entier (voir EntityTypeController.update). */
    public EntityType withUpdatedFields(String newLabel, Set<String> newAllowedExperienceTypes,
                                         Set<String> newCustomFieldKeys, String newColorKey, String newIconKey) {
        return new EntityType(id, code, newLabel, newAllowedExperienceTypes, newCustomFieldKeys, newColorKey, newIconKey);
    }

    public boolean allows(String experienceType) {
        return allowedExperienceTypes.contains(experienceType);
    }
}
