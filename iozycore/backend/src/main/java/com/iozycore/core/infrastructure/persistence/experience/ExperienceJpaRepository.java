package com.iozycore.core.infrastructure.persistence.experience;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ExperienceJpaRepository extends JpaRepository<ExperienceJpaEntity, UUID> {

    /**
     * Load by id, but THROUGH A QUERY.
     *
     * <p>JPA {@code findById} loads by primary key without a query:
     * Hibernate does not apply the owner isolation there
     * (see ProprietaireCourant), and the row of ANOTHER account comes back -
     * found while writing the isolation test, which passed on the lists and
     * failed on loads by id. This variant is a derived
     * query, so it is filtered like the others.
     */
    Optional<ExperienceJpaEntity> findOneById(UUID id);
    List<ExperienceJpaEntity> findByEntityId(UUID entityId);
    boolean existsByEntityId(UUID entityId);
}
