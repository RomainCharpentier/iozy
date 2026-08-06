package com.iozycore.infrastructure.persistence.ownership;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface OwnershipJpaRepository extends JpaRepository<OwnershipJpaEntity, UUID> {
    List<OwnershipJpaEntity> findByEntityId(UUID entityId);
    boolean existsByEntityId(UUID entityId);
}
