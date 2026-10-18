package com.iozycore.core.infrastructure.persistence.ownership;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface OwnershipJpaRepository extends JpaRepository<OwnershipJpaEntity, UUID> {

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
    Optional<OwnershipJpaEntity> findOneById(UUID id);
    List<OwnershipJpaEntity> findByEntityId(UUID entityId);
    boolean existsByEntityId(UUID entityId);
}
