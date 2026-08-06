package com.iozycore.infrastructure.persistence.catalog;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface EntityJpaRepository extends JpaRepository<EntityJpaEntity, UUID> {
    Optional<EntityJpaEntity> findByEntityTypeIdAndTitleIgnoreCase(UUID entityTypeId, String title);
    List<EntityJpaEntity> findByEntityTypeId(UUID entityTypeId);

    /**
     * Recherche transversale (UC4) : titleQuery/entityTypeId/tagId sont
     * chacun optionnels (passer null pour ignorer ce filtre). titleQuery
     * vide compte comme "aucun filtre de titre" - on ne veut pas exiger un
     * texte pour simplement filtrer par type ou par tag.
     */
    @Query("SELECT e FROM EntityJpaEntity e WHERE "
            + "(:titleQuery IS NULL OR :titleQuery = '' OR LOWER(e.title) LIKE LOWER(CONCAT('%', :titleQuery, '%'))) "
            + "AND (:entityTypeId IS NULL OR e.entityTypeId = :entityTypeId) "
            + "AND (:tagId IS NULL OR :tagId MEMBER OF e.tagIds) "
            + "ORDER BY e.title")
    List<EntityJpaEntity> search(@Param("titleQuery") String titleQuery,
                                  @Param("entityTypeId") UUID entityTypeId,
                                  @Param("tagId") UUID tagId);
}
