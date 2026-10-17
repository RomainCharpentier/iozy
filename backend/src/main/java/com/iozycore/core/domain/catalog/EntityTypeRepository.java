package com.iozycore.core.domain.catalog;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface EntityTypeRepository {

    EntityType save(EntityType entityType);

    Optional<EntityType> findById(UUID id);

    Optional<EntityType> findByCode(String code);

    /** Used by QuickAdd/EntityDetail (the 2 clients) to show the list of available types,
     * and by {@link com.iozycore.core.application.insights.StatsService} for the statistics by type. */
    List<EntityType> findAll();

    void deleteById(UUID id);
}
