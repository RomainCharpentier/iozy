package com.iozycore.manga.infrastructure.deals;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface PurchaseAnalysisJpaRepository extends JpaRepository<PurchaseAnalysisJpaEntity, UUID> {

    /**
     * Load by identifier, but THROUGH A QUERY.
     *
     * <p>JPA's {@code findById} loads by primary key without going through a
     * query: Hibernate does not apply the separation by owner there
     * (see ProprietaireCourant), and the row of ANOTHER account comes up -
     * seen while writing the isolation test, which passed on the lists and
     * failed on loads by identifier. This variant is a derived
     * query, so filtered like the others.
     */
    Optional<PurchaseAnalysisJpaEntity> findOneById(UUID id);
    List<PurchaseAnalysisJpaEntity> findAllByOrderByCreatedAtDesc();
}
