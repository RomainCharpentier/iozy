package com.iozycore.infrastructure.persistence.catalog;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface VariantJpaRepository extends JpaRepository<VariantJpaEntity, UUID> {
    List<VariantJpaEntity> findByEntityId(UUID entityId);
}
