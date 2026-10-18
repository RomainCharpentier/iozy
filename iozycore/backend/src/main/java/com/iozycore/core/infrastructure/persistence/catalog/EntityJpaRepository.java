package com.iozycore.core.infrastructure.persistence.catalog;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface EntityJpaRepository extends JpaRepository<EntityJpaEntity, UUID> {
    Optional<EntityJpaEntity> findByEntityTypeIdAndTitleIgnoreCase(UUID entityTypeId, String title);
    List<EntityJpaEntity> findByEntityTypeId(UUID entityTypeId);
    boolean existsByEntityTypeId(UUID entityTypeId);

    /**
     * The scope of a cross-type search (UC4): type and tag, each
     * optional (null to ignore this filter). The TITLE is no longer filtered
     * here - a LIKE on LOWER(title) did not fold accents or
     * punctuation, and "pokemon" did not find "Pokémon". It is filtered
     * in memory in the adapter (see JpaEntityRepositoryAdapter.search),
     * with the same rule as everywhere else (TexteRecherche).
     */
    @Query("SELECT e FROM EntityJpaEntity e WHERE "
            + "(:entityTypeId IS NULL OR e.entityTypeId = :entityTypeId) "
            + "AND (:tagId IS NULL OR :tagId MEMBER OF e.tagIds) "
            + "ORDER BY e.title")
    List<EntityJpaEntity> findByFiltres(@Param("entityTypeId") UUID entityTypeId,
                                        @Param("tagId") UUID tagId);
}
