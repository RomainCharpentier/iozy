package com.iozycore.core.infrastructure.persistence.ownership;

import com.iozycore.core.domain.ownership.Ownership;
import com.iozycore.core.domain.ownership.OwnershipCondition;
import com.iozycore.core.domain.ownership.OwnershipRepository;
import com.iozycore.core.domain.ownership.OwnershipStatus;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

@Repository
@Transactional
public class JpaOwnershipRepositoryAdapter implements OwnershipRepository {

    private final OwnershipJpaRepository jpaRepository;

    public JpaOwnershipRepositoryAdapter(OwnershipJpaRepository jpaRepository) {
        this.jpaRepository = jpaRepository;
    }

    @Override
    public Ownership save(Ownership ownership) {
        OwnershipJpaEntity saved = jpaRepository.save(toJpa(ownership));
        return toDomain(saved);
    }

    @Override
    public Optional<Ownership> findById(UUID id) {
        return jpaRepository.findOneById(id).map(JpaOwnershipRepositoryAdapter::toDomain);
    }

    @Override
    public List<Ownership> findByEntityId(UUID entityId) {
        return jpaRepository.findByEntityId(entityId).stream()
                .map(JpaOwnershipRepositoryAdapter::toDomain)
                .collect(Collectors.toList());
    }

    @Override
    public boolean existsByEntityId(UUID entityId) {
        return jpaRepository.existsByEntityId(entityId);
    }

    @Override
    public List<Ownership> findAll() {
        return jpaRepository.findAll().stream()
                .map(JpaOwnershipRepositoryAdapter::toDomain)
                .collect(Collectors.toList());
    }

    @Override
    public void deleteById(UUID id) {
        // Go through a filtered READ, never through deleteById: it
        // loads by primary key without a query, so without the owner
        // isolation - it deleted the row of another account, with no error and
        // no trace (found by the isolation test). Nothing to delete is
        // also the normal case: the port contract is idempotent.
        jpaRepository.findOneById(id).ifPresent(jpaRepository::delete);
    }

    private static OwnershipJpaEntity toJpa(Ownership ownership) {
        return new OwnershipJpaEntity(
                ownership.id(),
                ownership.entityId(),
                ownership.variantId().orElse(null),
                ownership.ownerId(),
                ownership.condition().name(),
                ownership.status().name(),
                ownership.acquiredAt(),
                ownership.note(),
                ownership.purchasePrice().orElse(null)
        );
    }

    private static Ownership toDomain(OwnershipJpaEntity jpaEntity) {
        return Ownership.reconstitute(
                jpaEntity.getId(),
                jpaEntity.getEntityId(),
                jpaEntity.getVariantId(),
                jpaEntity.getOwnerId(),
                OwnershipCondition.valueOf(jpaEntity.getCondition()),
                OwnershipStatus.valueOf(jpaEntity.getStatus()),
                jpaEntity.getAcquiredAt(),
                jpaEntity.getNote(),
                jpaEntity.getPurchasePrice()
        );
    }
}
