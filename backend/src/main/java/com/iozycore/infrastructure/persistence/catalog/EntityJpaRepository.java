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
    boolean existsByEntityTypeId(UUID entityTypeId);

    /**
     * Le perimetre d'une recherche transversale (UC4) : type et tag, chacun
     * optionnel (null pour ignorer ce filtre). Le TITRE ne se filtre plus
     * ici - un LIKE sur LOWER(title) ne pliait ni les accents ni la
     * ponctuation, et « pokemon » ne trouvait pas « Pokémon ». Il se filtre
     * en memoire dans l'adaptateur (voir JpaEntityRepositoryAdapter.search),
     * avec la meme regle que partout ailleurs (TexteRecherche).
     */
    @Query("SELECT e FROM EntityJpaEntity e WHERE "
            + "(:entityTypeId IS NULL OR e.entityTypeId = :entityTypeId) "
            + "AND (:tagId IS NULL OR :tagId MEMBER OF e.tagIds) "
            + "ORDER BY e.title")
    List<EntityJpaEntity> findByFiltres(@Param("entityTypeId") UUID entityTypeId,
                                        @Param("tagId") UUID tagId);
}
