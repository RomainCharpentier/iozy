package com.iozycore.core.domain.catalog;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface EntityTypeRepository {

    EntityType save(EntityType entityType);

    Optional<EntityType> findById(UUID id);

    Optional<EntityType> findByCode(String code);

    /** Utilisé par QuickAdd/EntityDetail (les 2 clients) pour afficher la liste des types disponibles,
     * et par {@link com.iozycore.core.insights.StatsService} pour les statistiques par type. */
    List<EntityType> findAll();

    void deleteById(UUID id);
}
