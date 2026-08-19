package com.iozycore.infrastructure.persistence.tierlist;

import com.iozycore.domain.tierlist.EntityRank;
import com.iozycore.domain.tierlist.EntityRankRepository;
import com.iozycore.domain.tierlist.Rank;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

interface EntityRankJpaRepository extends JpaRepository<EntityRankJpaEntity, UUID> {
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
        return jpaRepository.findById(entityId).map(JpaEntityRankRepositoryAdapter::toDomain);
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
        jpaRepository.deleteById(entityId);
    }

    private static EntityRankJpaEntity toJpa(EntityRank rank) {
        return new EntityRankJpaEntity(rank.entityId(), rank.ownerId(), rank.rank().name(), rank.rankedAt());
    }

    private static EntityRank toDomain(EntityRankJpaEntity jpa) {
        return EntityRank.reconstitute(jpa.getEntityId(), jpa.getOwnerId(), Rank.valueOf(jpa.getRank()), jpa.getRankedAt());
    }
}
