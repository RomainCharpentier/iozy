package com.iozycore.infrastructure.persistence.experience;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface ExperienceJpaRepository extends JpaRepository<ExperienceJpaEntity, UUID> {
    List<ExperienceJpaEntity> findByEntityId(UUID entityId);
    boolean existsByEntityId(UUID entityId);
}
