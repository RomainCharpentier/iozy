package com.iozycore.core.infrastructure.persistence.tierlist;

import com.iozycore.core.domain.tierlist.EntityRank;
import com.iozycore.core.domain.tierlist.EntityRankRepository;
import com.iozycore.core.domain.tierlist.Rank;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

interface EntityRankJpaRepository extends JpaRepository<EntityRankJpaEntity, UUID> {

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
    Optional<EntityRankJpaEntity> findOneByEntityId(UUID entityId);
    List<EntityRankJpaEntity> findByEntityIdIn(Set<UUID> entityIds);
}

@Repository
@Transactional
class JpaEntityRankRepositoryAdapter implements EntityRankRepository {

    private final EntityRankJpaRepository jpaRepository;

    JpaEntityRankRepositoryAdapter(EntityRankJpaRepository jpaRepository) {
        this.jpaRepository = jpaRepository;
    }

    @Override
    public EntityRank save(EntityRank entityRank) {
        EntityRankJpaEntity saved = jpaRepository.save(toJpa(entityRank));
        return toDomain(saved);
    }

    @Override
    public Optional<EntityRank> findByEntityId(UUID entityId) {
        return jpaRepository.findOneByEntityId(entityId).map(JpaEntityRankRepositoryAdapter::toDomain);
    }

    @Override
    public List<EntityRank> findByEntityIds(Set<UUID> entityIds) {
        if (entityIds.isEmpty()) return List.of();
        return jpaRepository.findByEntityIdIn(entityIds).stream()
                .map(JpaEntityRankRepositoryAdapter::toDomain)
                .collect(Collectors.toList());
    }

    @Override
    public void deleteByEntityId(UUID entityId) {
        // Go through a filtered READ, never through deleteById: it
        // loads by primary key without a query, so without the owner
        // isolation - it deleted the row of another account, with no error and
        // no trace (found by the isolation test). Nothing to delete is
        // also the normal case: the port contract is idempotent.
        jpaRepository.findOneByEntityId(entityId).ifPresent(jpaRepository::delete);
    }

    private static EntityRankJpaEntity toJpa(EntityRank rank) {
        return new EntityRankJpaEntity(rank.entityId(), rank.ownerId(), rank.rank().name(), rank.rankedAt());
    }

    private static EntityRank toDomain(EntityRankJpaEntity jpa) {
        return EntityRank.reconstitute(jpa.getEntityId(), jpa.getOwnerId(), Rank.valueOf(jpa.getRank()), jpa.getRankedAt());
    }
}
