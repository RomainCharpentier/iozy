package com.iozycore.core.infrastructure.persistence.catalog;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface VariantJpaRepository extends JpaRepository<VariantJpaEntity, UUID> {
    List<VariantJpaEntity> findByEntityId(UUID entityId);

    /** Grouped loading: without it, listing N works cost N queries for volumes
     * (one per work), on the busiest path of the app - see
     * JpaEntityRepositoryAdapter.withVariants. */
    List<VariantJpaEntity> findByEntityIdIn(Collection<UUID> entityIds);
}
