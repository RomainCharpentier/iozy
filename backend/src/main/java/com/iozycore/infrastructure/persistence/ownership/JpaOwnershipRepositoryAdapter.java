package com.iozycore.infrastructure.persistence.ownership;

import com.iozycore.domain.ownership.Ownership;
import com.iozycore.domain.ownership.OwnershipCondition;
import com.iozycore.domain.ownership.OwnershipRepository;
import com.iozycore.domain.ownership.OwnershipStatus;
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
        // Passer par une LECTURE filtrée, jamais par un deleteById : celui-ci
        // charge par clé primaire sans requête, donc sans le cloisonnement par
        // propriétaire - il effaçait la ligne d'un autre compte, sans erreur et
        // sans trace (constaté par le test d'isolation). Rien à supprimer est
        // aussi le cas normal : le contrat du port est idempotent.
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
