package com.iozycore.core.infrastructure.persistence.catalog;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface VariantJpaRepository extends JpaRepository<VariantJpaEntity, UUID> {
    List<VariantJpaEntity> findByEntityId(UUID entityId);

    /** Chargement groupé : sans elle, lister N œuvres coûtait N requêtes de tomes
     * (une par œuvre), sur le chemin le plus fréquenté de l'app - voir
     * JpaEntityRepositoryAdapter.withVariants. */
    List<VariantJpaEntity> findByEntityIdIn(Collection<UUID> entityIds);
}
