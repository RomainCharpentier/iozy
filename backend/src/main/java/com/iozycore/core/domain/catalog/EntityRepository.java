package com.iozycore.core.domain.catalog;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Port du domaine pour la persistance des Entity. L'implémentation
 * (JPA/PostgreSQL) vit en infrastructure — le domaine ne connaît que
 * cette interface (Clean Architecture, étape 10-11 de la conception).
 */
public interface EntityRepository {

    Entity save(Entity entity);

    Optional<Entity> findById(UUID id);

    /**
     * Utilisé par la déduplication de l'ajout rapide (UC1, étape 6) :
     * recherche insensible à la casse, pour retrouver une Entity déjà
     * cataloguée avant d'en recréer une en double.
     */
    Optional<Entity> findByTypeAndTitle(UUID entityTypeId, String title);

    /** Utilisé pour rafraîchir un client après un import en masse (ex: collection BGG). */
    List<Entity> findAllByType(UUID entityTypeId);

    /** Utilisé par le garde-fou de suppression d'un EntityType (on ne charge pas les Entity juste pour compter). */
    boolean existsByType(UUID entityTypeId);

    /**
     * Recherche transversale sur la collection (UC4, étape 1/6 de la
     * conception : "recherche instantanée transversale"). entityTypeId et
     * tagId sont des filtres optionnels (null = pas de filtre sur ce critère).
     */
    List<Entity> search(String titleQuery, UUID entityTypeId, UUID tagId);

    void deleteById(UUID id);
}
